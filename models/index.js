var fs        = require("fs");
var path      = require("path");

var cls = require('continuation-local-storage');
var namespace = cls.createNamespace('request-local-storage');

var Sequelize = require("sequelize");
Sequelize.cls = namespace;

//var config    = require(__dirname + '/../config/config.json')[env];
var sequelize = new Sequelize('mysql://root:root@localhost:3306/tvster');
var db = {}

fs
  .readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf(".") !== 0) && (file !== "index.js");
  })
  .forEach(function(file) {
    // Import the model represented in 'file' and save it in the db object
    var model = sequelize.import(path.join(__dirname, file));
    db[model.name] = model;
  });

// For each key in db object (e.g for each model object defined), if 'associate'
// is a member, then call it passing in the whole models object (db, models)
Object.keys(db).forEach(function(modelName) {
    if ("associate" in db[modelName]) {
      db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// as this is in index.js, we will invoke this when requiring 'models' folder
module.exports = db;
