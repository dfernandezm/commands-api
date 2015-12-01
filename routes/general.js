var express = require('express');
var router = express.Router();

// All routes
router.use(function(req, res, next) {
    // do logging
    console.log('Invoking routes');
    next(); // make sure we go to the next routes and don't stop here
});

// get /
router.get('/', function (req, res) {
    res.json({ message: 'Welcome'});
});


module.exports = router;
