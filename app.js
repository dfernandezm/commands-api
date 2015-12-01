var express = require('express');
var bodyParser = require('body-parser');

var app = express();
app.use(express.static('public'));

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var router = require('./routes')(app);

// Basic error Handling
app.use(function(err, req, res, next) {
    console.log("Error ", err);
    res.status(err.status || 500);
});

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('App listening at http://%s:%s', host, port);
});

module.exports = app;
