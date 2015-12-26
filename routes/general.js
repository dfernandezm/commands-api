var router = require('./router');

// For all routes
router.use(function(req, res, next) {
    // do logging
    console.log('Invoking routes');
    next(); // make sure we go to the next routes and don't stop here
});

/**
 GET /
*/
router.get('/', function (req, res) {
  console.log("should invoke this...")
  res.json({ message: 'Welcome to commands api'});
});

/**
 GET /status
*/
router.get('/status', function (req, res) {
   res.json({ status: 'OK'});
});


module.exports = router;
