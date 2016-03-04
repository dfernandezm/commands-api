var log = require('./logger');
var transmissionService = require('./transmissionService');
var utilService = require('./utilService');
var Torrent = require('../models').torrent;
var TorrentState = require('./torrentState');
var Promise = require('bluebird');
var utilService = require('./utilService');
var moment = require('moment');

var torrentService = {}

torrentService.updateTorrentsStatus = function() {
  utilService.startNewInterval('torrentsStatus', torrentService.updateDataForTorrents, 4000);
}

torrentService.updateDataForTorrents = function() {
  log.debug("Updating torrents..");
  transmissionService.status().then(function(data) {
    var torrentsResponse = data.arguments.torrents;

    Promise.map(torrentsResponse, function(torrentResponse) {
      // Promise.map awaits for returned promises as well.
      log.debug("Processing response for torrent hash: ", torrentResponse.hashString);
      return processSingleTorrentResponse(torrentResponse);
    }).then(function() {
      console.log("Processed whole response!");
    });
  });
}

torrentService.findTorrentByHash = function(torrentHash) {
  return Torrent.findOne({ where: {hash: torrentHash} }); // returns the torrent found or null
}

torrentService.stopTorrentsStatus = function() {
  utilService.stopInterval('torrentsStatus');
}

torrentService.persistTorrent = function(torrent) {
  return Torrent.create(torrent).then(function(newTorrent) {
    return newTorrent;
  });
}

// ----- PRIVATE ------------------------------------------------

function processSingleTorrentResponse(torrentResponse) {
	var torrentHash = torrentResponse.hashString;
  var findTorrent = torrentService.findTorrentByHash(torrentHash);
  return findTorrent.then(createOrUpdateTorrent(torrentResponse, torrentHash));
}

function createOrUpdateTorrent(torrentResponse, torrentHash) {
  return function (existingTorrent) {
    if (existingTorrent === null) {
      log.debug("Torrent does not exist with hash: " + torrentHash + " -- creating now");
      return createAndRelocateTorrent(torrentResponse);
    } else {
      log.debug("Torrent exists: " + torrentHash + " -- updating");
      return updateExistingTorrentFromResponse(existingTorrent, torrentResponse);
    }
  }
}

function updateExistingTorrentFromResponse(existingTorrent, torrentResponse) {
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
      torrentState !== TorrentState.FAILED &&
      torrentState !== TorrentState.COMPLETED) {

      existingTorrent.percentDone = percentDone;

      if (torrentState !== TorrentState.DOWNLOADING && torrentState !== TorrentState.PAUSED) {
        existingTorrent.state(TorrentState.DOWNLOADING);
        log.debug("Torrent ", torrentName, " found in DB, setting as DOWNLOADING");
      }

  } else if (percentDone == 100 && (torrentState == TorrentState.DOWNLOADING || torrentState == null || torrentState == '')) {

    existingTorrent.percentDone = 100;
    existingTorrent.state = TorrentState.DOWNLOAD_COMPLETED;
    existingTorrent.dateFinished = moment.utc().toDate(); //only dates in sequelize

    log.info("[UPDATE-TORRENTS] Torrent ", torrentName, " finished downloading -- DOWNLOAD_COMPLETED");
  }

  return existingTorrent.save().then(function(savedTorrent) {
    // Clear finished torrents from Transmission directly
    if (torrentState == TorrentState.COMPLETED) {
      log.info("Torrent ", savedTorrent.hash, " COMPLETED -- removing from Transmission");
      return transmissionService.cancelTorrent(savedTorrent.hash);
    }
  });
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
    torrent.guid = utilService.generateGuid();
    torrent.name = torrentResponse.name;
    torrent.dateStarted = moment.utc().toDate();
    torrent.finished = false;

    if (percentDone > 0 && percentDone < 100) {
      torrent.state = TorrentState.DOWNLOADING;
      log.debug("[UPDATE-TORRENTS] Torrent ", torrent.name,
                " set as DOWNLOADING, percentDone ",percentDone);
    } else if (percentDone == 100) {
      torrent.state = TorrentState.DOWNLOAD_COMPLETED;
      log.info("[UPDATE-TORRENTS] Torrent ", torrent.name, " finished downloading -- DOWNLOAD_COMPLETED");
      torrent.dateFinished = moment.utc().toDate();
      torrent.finished = true;
    }

    torrent.title = torrentResponse.name;
    torrent.hash = torrentResponse.hashString;
    torrent.contentType = null;
    torrent.percentDone = percentDone;
    torrent.magnetLink = torrentResponse.magnetLink;

		return torrentService.persistTorrent(torrent).then(function(persistedTorrent) {
      log.debug("Persisted torrent ", persistedTorrent);
      return persistedTorrent;
    });
  }
}


module.exports = torrentService;
