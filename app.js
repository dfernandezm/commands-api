var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var engine = require('ejs-mate');
app.use('/materialize', express.static(__dirname + '/public/materialize'));
app.use('/client', express.static(__dirname + '/public/client'));

app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// https://github.com/JacksonTian/ejs-mate



// var hoffman = require('hoffman');
// app.set('views', path.join(__dirname, 'views')); // path to your templates
// app.set('view engine', 'dust');
// app.engine('dust', hoffman.__express());
//
// // works with caching
// app.set('view cache', true);

// optionally load all templates into dust cache on server start
// hoffman.prime(app.settings.views);


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

// var server = app.listen(3000, function () {
//   var host = server.address().address;
//   var port = server.address().port;
//
//   console.log('App listening at http://%s:%s', host, port);
// });

module.exports = app;
