var router = require('./router');
var debug = require('debug')('tvster');

/**
 GET /api/search?searchQuery=XX&sitesParam=YY
 */
router.get('/api/search', function(req, res) {
   var query = req.query.searchQuery;
   var sitesParam = req.query.sitesParam.split(',');
   res.json({result: "query " + query + ", sitesParam " + sitesParam[0]})
});

module.exports = router;
