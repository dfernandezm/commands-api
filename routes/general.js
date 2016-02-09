var router = require('./router');
var crawler = require('../services/crawler')

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
  // res.json({ message: 'Welcome to commands api'});
  res.render('pages/index');
});

router.get('/filemanager', function (req, res) {
  // res.json({ message: 'Welcome to commands api'});
  res.render('pages/filemanager');
});

router.get('/search', function (req, res) {
  // res.json({ message: 'Welcome to commands api'});
  res.render('pages/search');
});

router.get('/status', function (req, res) {
  // res.json({ message: 'Welcome to commands api'});
  res.render('pages/status');
});

router.get('/automation', function (req, res) {
  // res.json({ message: 'Welcome to commands api'});
  res.render('pages/automation');
});

/**
 GET /status
*/
router.get('/serverstatus', function (req, res) {
   crawler.test(0);
   crawler.test(1);
   crawler.test(2);
   crawler.test(3);
   crawler.test(4);
   crawler.test(5);
   res.json({ status: 'OK'});
});


module.exports = router;
