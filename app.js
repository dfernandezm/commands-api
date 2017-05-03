const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const engine = require('ejs-mate');
const auth = require('basic-auth');
const utils = require("./services/utilService");

app.use('/client', express.static(__dirname + '/public/client'));

app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Temporarily, use basic authentication with username and password passed in as environment variables
if (!utils.isWorker()) {
    app.use(function(req, res, next) {
        let credentials = auth(req);
        let username = process.env.USERNAME;
        let password = process.env.PASSWORD;

        if (credentials === undefined || credentials.name !== username || credentials.pass !== password) {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="TVster"');
            res.end('Unauthorized');
        } else {
            next();
        }
    });
}

// Build all routes
const router = require('./routes')(app);

// Basic error Handling
app.use(function(err, req, res) {
    console.log("Error ", err);
    res.status(err.status || 500);
});

module.exports = app;
