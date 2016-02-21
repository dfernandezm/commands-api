var router = require('./router');
var debug = require('debug')('tvster');
var crawlerService = require('../services/crawlers/crawlerService');
/**
 GET /api/search?searchQuery=XX&sitesParam=YY
 */
router.get('/api/search', function(req, res) {
  //  var query = req.query.searchQuery;
  //  var sitesParam = req.query.sitesParam.split(',');
  //  res.json({result: "query " + query + ", sitesParam " + sitesParam[0]})

  crawlerService.recentVideoTorrents(req.query.page).then(function(result) {
    res.json({torrents: result});
  });

});

module.exports = router;
