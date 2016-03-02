var router = require('./router');
var debug = require('debug')('tvster');
var transmissionService = require('../services/transmissionService');
var log = require('../services/logger');
/**
 GET /api/transmission/status
 */
router.get('/api/transmission/start', function(req, res) {
  var torrent = {};
  torrent.magnetLink = "http://www.divxtotal.com/torrents_tor/The.Big.Bang.Theory.9x03.HDTV.XviD.%5Bwww.DivxTotaL.com%5D.t50309.torrent";
  transmissionService.startTorrent(torrent).then(function(result) {
      res.json({status: result});
  });
});

router.get('/api/transmission/status', function(req, res) {
  transmissionService.status().then(function(result) {
      res.json({status: result});
  });

});

router.get('/api/transmission/cancel/:hash', function(req, res) {
  var torrent = {};
  torrent.hash = req.params.hash;
  log.info("The hash to cancel is " + torrent.hash);
  transmissionService.cancelTorrent(torrent.hash).then(function(result) {
      res.json({result: result});
  });

});

// router.get('/api/transmission/relocate', function(req, res) {
//   transmissionService.relocate().then(function(result) {
//       res.json({status: result});
//   });
//
// });


module.exports = router;
