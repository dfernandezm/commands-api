var router = require('./router');
var debug = require('debug')('tvster');
var transmissionService = require('../services/transmissionService');
/**
 GET /api/transmission/status
 */
router.get('/api/transmission/status', function(req, res) {

  transmissionService.testConnection().then(function(result) {
      res.json({status: result});
  });

});


module.exports = router;
