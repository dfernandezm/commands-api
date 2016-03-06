var router = require('./router');
var debug = require('debug')('tvster');
var transmissionService = require('../services/transmissionService');
var torrentService = require('../services/torrentService');
var log = require('../services/logger');
var utilService = require('../services/utilService');

/**
 *
 * POST /api/torrents/start
 *
 */
router.post('/api/torrents/start', function(req, res) {
  var torrent = req.body.torrent;

  if (torrent.magnetLink !== null || torrent.torrentFileLink !== null) {
    torrentService.startTorrentDownload(torrent).then(function(downloadingTorrent) {
      log.info("[TORRENT-API] Torrent successfully started.")
      torrentService.updateTorrentsStatus();
      res.json({torrent: downloadingTorrent});
    }).catch(utilService.handleApiError(res));
  } else {
    utilService.generateErrorResponse(res, "INVALID_TORRENT", 400,
                            "The torrent does not have magnetLink or file link");
  }
});

router.put('/api/torrents/status', function(req, res) {
  torrentService.getCurrentStatus().then(function(result) {
    var jsonResult = JSON.stringify(result, utilService.jsonSerializer);
    res.json({torrents: JSON.parse(jsonResult)});
  }).catch(utilService.handleApiError(res));
});

router.delete('/api/torrents/cancel/:hash', function(req, res) {
  var torrent = {};
  torrent.hash = req.params.hash;
  log.debug("Cancelling torrent: " + torrent.hash);
  torrentService.deleteTorrent(torrent.hash, true).then(function(result) {
      res.json({result: result});
  }).catch(utilService.handleApiError(res));
});

router.put('/api/torrents/pause/:hash', function(req, res) {
  var torrentHash = req.params.hash;
  torrentService.pauseTorrent(torrentHash).then(function(paused) {
    res.json({torrent: paused});
  }).catch(utilService.handleApiError(res));
});

router.put('/api/torrents/resume/:hash', function(req, res) {
  var torrentHash = req.params.hash;
  torrentService.resumeTorrent(torrentHash).then(function(resumed) {
    res.json({torrent: resumed});
  }).catch(utilService.handleApiError(res));
});

// ------ Testing, to be deleted from here

router.get('/api/torrents/status', function(req, res) {
  transmissionService.status().then(function(result) {
      res.json({status: result});
  });
});

router.get('/api/torrents/checkstatus', function(req, res) {
  torrentService.updateTorrentsStatus();
  res.json({result: "OK"});
});

router.get('/api/torrents/statusstop', function(req, res) {
  torrentService.stopTorrentsStatus();
  res.json({result: "OK"});
});

module.exports = router;
