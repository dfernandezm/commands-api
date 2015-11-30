var express = require('express');
var bodyParser = require('body-parser');

var app = express();
app.use(express.static('public'));
var router = express.Router();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/api', router);

// All routes
router.use(function(req, res, next) {
    // do logging
    console.log('Invoking routes');
    next(); // make sure we go to the next routes and don't stop here
});

// Define 1 route
router.get('/main', function (req, res) {
  res.json({ message: 'Hello World!'});
});

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('App listening at http://%s:%s', host, port);
});
