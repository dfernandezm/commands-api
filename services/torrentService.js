var log = require('./logger');
var transmissionService = require('./transmissionService');
var utilService = require('./utilService');
var Torrent = require('../models').torrent;
var TorrentState = require('./torrentState');

var torrentService = {}

torrentService.updateTorrentsStatus = function() {
  utilService.startNewInterval('torrentsStatus', transmissionService.updateTorrentsStatus, 4000);
}

torrentService.updateDataForTorrents = function() {
  log.debug("Updating torrents..");
  transmissionService.status().then(function(data) {
    var torrents = arguments.torrents;
    //processSingleTorrent()

  });
}

torrentService.findTorrentByHash = function(torrentHash) {
  return Torrent.findOne({ where: {hash: torrent} }).then(function(torrent) {
     // first entry of the table with the hash 'hash' or null
     return torrent;
  });
}

torrentService.stopTorrentsStatus = function() {
  utilService.stopInterval('torrentsStatus');
}

// ----- PRIVATE -----

function processSingleTorrentResponse(torrentResponse) {

	var torrentHash = torrentResponse.hashString;
  var findTorrent = torrentService.findTorrentByHash(torrentHash);

  return findTorrent.then(createOrUpdateTorrent(torrentResponse, torrentHash));
}

function createOrUpdateTorrent(torrentResponse, torrentHash) {
  return function (existingTorrent) {
    if (existingTorrent === null) {
      log.debug("Torrent does not exist with hash: " + torrentHash);
      return createAndRelocateTorrent(torrentResponse);
    } else {
      return updateExistingTorrentWithResponse(existingTorrent, torrentResponse);
    }
  }
}

function updateExistingTorrentWithResponse(existingTorrent, torrentResponse) {
  var torrentState = existingTorrent.state;
  var percentDone = torrentResponse.percentDone;
  existingTorrent.magnetLink = torrentResponse.magnetLink;
  var torrentName = existingTorrent.name;
  var currentPercent = existingTorrent.percentDone;

  log.debug("[UPDATE-TORRENTS] Torrent response: ", torrentResponse.name,
            " is DOWNLOADING, state read is ", torrentState, ", ",
            torrentResponse.percentDone, '%');
  log.debug("[UPDATE-TORRENTS] Torrent DB: ", torrentName, ' is ', torrentState,
            ' stored percentage is ', currentPercent);

  if (percentDone != null && percentDone > 0 && percentDone < 100 &&
    currentPercent != 100 &&
    torrentState !== TorrentState.DOWNLOAD_COMPLETED &&
    torrentState !== TorrentState.RENAMING &&
    torrentState !== TorrentState.RENAMING_COMPLETED &&
    torrentState !== TorrentState.FETCHING_SUBTITLES &&
    torrentState !== TorrentState.FAILED_DOWNLOAD_ATTEMPT &&
    torrentState !== TorrentState.COMPLETED) {

      existingTorrent.percentDone(percentDone);

      if (torrentState !== TorrentState.DOWNLOADING && torrentState !== TorrentState.PAUSED) {
        existingTorrent.state(TorrentState.DOWNLOADING);
        log.debug("Torrent ", torrentName, " found in DB, setting as DOWNLOADING");
      }

    } else if (percentDone == 100 && (torrentState == TorrentState.DOWNLOADING || torrentState == null || torrentState == '')) {

        existingTorrent.percentDone = 100;
        existingTorrent.state = TorrentState.DOWNLOAD_COMPLETED;
        existingTorrent.dateFinished = moment();

        log.info("[UPDATE-TORRENTS] Torrent ", torrentName, " finished downloading, percent ", percentDone);
        //TODO: add to finished set

      //TODO: update in DB, get promise
      //TODO: add existingTorrent to updated set

      // Clear finished torrents from Transmission directly
      if (torrentState == TorrentState.COMPLETED) {
        //TODO: return promise to chain
        transmissionService.deleteTorrent(existingTorrent.hash);
      }
    }
    //else, CREAted, delete this!
}


//TODO: execute in a transaction
function createAndRelocateTorrent(torrentResponse) {

  log.debug("[UPDATE-TORRENTS] Torrent ", torrentResponse.name,
            "with hash ", torrentResponse.hashString, " not found on DB,",
            " creating and relocating now");

  var torrent = {};

  // Relocate the torrent to the known subfolder as we are creating it now
  var newLocation = null;
  var relocation = transmissionService.relocateAndRestart(torrentResponse.name,
                                         torrentResponse.hashString)
                     .then(populateTorrentAndReturn(torrentResponse, torrent));
  return relocation;
}

function populateTorrentAndReturn(torrentResponse, torrent) {
  return function (newLocation) {
    var percentDone = 100 * torrentResponse.percentDone;
    torrent.filePath = newLocation;
    torrent.guid = utilsService.generateGuid();
    torrent.name = torrentResponse.name;
    torrent.dateStarted = moment();
    torrent.finished = false;

    if (percentDone > 0 && percentDone < 100) {
      torrent.state = TorrentState.DOWNLOADING;
      log.debug("[UPDATE-TORRENTS] Torrent ", torrent.name,
                " set as DOWNLOADING, percentDone ",percentDone);
    } else if (percentDone == 100) {
      torrent.state = TorrentState.DOWNLOAD_COMPLETED;
      log.info("[UPDATE-TORRENTS] Torrent ", torrentName, " finished downloading -- DOWNLOAD_COMPLETED");
      torrent.dateFinished = moment();
      torrent.finished = true;
    }

    torrent.title = torrentResponse.name;
    torrent.hash = torrentResponse.hashString;
    torrent.contentType = null;
    torrent.percentDone = percentDone;
    torrent.magnetLink = torrentResponse.magnetLink;

		return persistTorrent(torrent).then(function(persistedTorrent) {
      log.debug("Persisted torrent ", persistedTorrent);
      return persistedTorrent;
    });
  }
}


module.exports = torrentService;
