let router = require('./router');
let debug = require('debug')('tvster');
let transmissionService = require('../services/transmissionService');
let torrentService = require('../services/torrentService');
let filebotService = require('../services/filebotService');
let log = require('../services/logger');
let utilService = require('../services/utilService');

/**
 *
 * POST /api/torrents/start
 *
 */
router.post('/api/torrents/start', function(req, res) {
  let torrent = req.body.torrent;

  if (torrent.magnetLink !== null || torrent.torrentFileLink !== null) {
    torrentService.startTorrentDownload(torrent).then(function(downloadingTorrent) {
      log.info("[TORRENT-API] Torrent successfully started.");
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
    let jsonResult = JSON.stringify(result, utilService.jsonSerializer);
    torrentService.updateTorrentsStatus();
    res.json({torrents: JSON.parse(jsonResult)});

  }).catch(utilService.handleApiError(res));
});

router.delete('/api/torrents/cancel/:hash', function(req, res) {
  let torrent = {};
  torrent.hash = req.params.hash;
  log.debug("Cancelling torrent: " + torrent.hash);
  torrentService.deleteTorrent(torrent.hash, true).then(function(result) {
      res.json({result: result});
  }).catch(utilService.handleApiError(res));
});

router.put('/api/torrents/pause/:hash', function(req, res) {
  let torrentHash = req.params.hash;
  torrentService.pauseTorrent(torrentHash).then(function(paused) {
    res.json({torrent: paused});
  }).catch(utilService.handleApiError(res));
});

router.put('/api/torrents/resume/:hash', function(req, res) {
  let torrentHash = req.params.hash;
  torrentService.resumeTorrent(torrentHash).then(function(resumed) {
    res.json({torrent: resumed});
  }).catch(utilService.handleApiError(res));
});

router.put('/api/torrents/rename/:hash', function(req, res) {
  let torrentHash = req.params.hash;
  log.info("The hash is " + torrentHash);
  torrentService.rename(torrentHash).then(function(result) {
    res.json({torrent: result});
  }).catch(utilService.handleApiError(res));
});

router.put('/api/torrents/subtitles/:hash', function(req, res) {
    let torrentHash = req.params.hash;
    log.info("The hash is " + torrentHash);
    torrentService.fetchSubtitles(torrentHash).then(function(result) {
        res.json({torrent: result});
    }).catch(utilService.handleApiError(res));
});

module.exports = router;
