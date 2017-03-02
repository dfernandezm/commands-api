var fs        = require("fs");
var path      = require("path");

var db = {};

if (!process.env.TVSTER_MODE || process.env.TVSTER_MODE !== 'organizer') {

    var cls = require('continuation-local-storage');
    var namespace = cls.createNamespace('request-local-storage');

    var Sequelize = require("sequelize");
    Sequelize.cls = namespace;

    var env = 'staging';
    var config = require(__dirname + '/../config/config.json')[env];

    let passwordPart="";
    if (process.env.MYSQL_PASSWORD) {
        passwordPart = ":" + process.env.MYSQL_PASSWORD;
    }

    config.url = "mysql://root" + passwordPart + "@" + process.env.MYSQL_URL + ":" + process.env.MYSQL_PORT + "/tvster";
    var sequelize = new Sequelize(config.url);


    fs
        .readdirSync(__dirname)
        .filter(function (file) {
            return (file.indexOf(".") !== 0) && (file !== "index.js");
        })
        .forEach(function (file) {
            // Import the model represented in 'file' and save it in the db object
            var model = sequelize.import(path.join(__dirname, file));
            db[model.name] = model;
        });

// For each key in db object (e.g for each model object defined), if 'associate'
// is a member, then call it passing in the whole models object (db, models)
    Object.keys(db).forEach(function (modelName) {
        if ("associate" in db[modelName]) {
            db[modelName].associate(db);
        }
    });

    db.sequelize = sequelize;
    db.Sequelize = Sequelize;
} else {
    db.sequelize = {};
    db.Sequelize = {};
}

// as this is in index.js, we will invoke this when requiring 'models' folder
module.exports = db;
