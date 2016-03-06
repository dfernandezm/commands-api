var log = require('./logger');
var transmissionService = require('./transmissionService');
var utilService = require('./utilService');
var Torrent = require('../models').torrent;
var TorrentState = require('./torrentState');
var Promise = require('bluebird');
var utilService = require('./utilService');
var moment = require('moment');
var _ = require('lodash');
var torrentUtilsService = require('./torrentUtilsService');

var torrentService = {}

torrentService.updateTorrentsStatus = function() {
  utilService.startNewInterval('torrentsStatus', torrentService.updateDataForTorrents, 4000);
}

torrentService.updateDataForTorrents = function() {
  log.debug("Updating torrents..");
  transmissionService.status().then(function(data) {
    var torrentsResponse = data.arguments.torrents;
    if (torrentsResponse.length == 0) {
      utilService.stopInterval('torrentsStatus');
    } else {
      Promise.map(torrentsResponse, function(oneTorrentResponse) {
        // Promise.map awaits for returned promises as well.
        log.debug("Processing response for torrent hash: ", oneTorrentResponse.hashString);
        return processSingleTorrentResponse(oneTorrentResponse);
      });
    }
  });
}

torrentService.findByHash = function(torrentHash) {
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

torrentService.updateTorrent = function(torrent) {
  return torrentService.findByGuid(torrent.guid).then(function(currentTorrent) {
    if (currentTorrent === null) {
      log.debug("Torrent with guid ", guid, " not found -- aborting update");
      return null;
    } else {
      log.debug("Updating torrent with GUID ", torrent.guid);
      _.extend(currentTorrent, torrent);
      return currentTorrent.save();
    }
  });
}

torrentService.pauseTorrent = function(torrent) {
	return transmissionService.pauseTorrent(torrent.hash).then(function() {
    log.debug("Pausing torrent: ", torrent.name);
    torrent.state = TorrentState.PAUSED;
    return torrentService.updateTorrent(torrent);
  });
}

torrentService.resumeTorrent = function(torrent) {
	return transmissionService.resumeTorrent(torrent.hash).then(function() {
    log.debug("Resuming torrent: ", torrent.name);
	  torrent.state = torrent.DOWNLOADING;
	  return torrentService.updateTorrent(torrent);
	});
}

torrentService.findTorrentByFileLink = function(fileLink) {
  return Torrent.findOne({ where: {torrentFileLink: fileLink} });
}

torrentService.findByGuid = function(guid) {
  return Torrent.findOne({ where: {guid: guid} });
}

torrentService.findTorrentByMagnetLink= function(magnetLink) {
  return Torrent.findOne({ where: {magnetLink: magnetLink} });
}

torrentService.startTorrentDownload = function(torrent) {
	var existingTorrentPromise = {};
  var torrentFileLink = torrent.torrentFileLink
  var magnetLink = torrent.magnetLink;
  var link = null;

  if (torrentFileLink) {
    existingTorrentPromise = torrentService.findTorrentByFileLink(torrent.torrentFileLink)
    log.debug("[TORRENT-API] Starting download from torrent file: ", torrentFileLink);
    link = torrentFileLink;
  } else if (magnetLink) {
    existingTorrentPromise = torrentService.findTorrentByMagnetLink(torrent.magnetLink);
    log.debug("[TORRENT-API] Starting download from torrent magnet: ", magnetLink);
    link = magnetLink;
  }

  torrent.title = torrent.torrentName =
    torrent.title || torrent.torrentName || torrentUtilsService.getNameFromMagnetLinkOrTorrentFile(link);

  log.debug("Torrent title: ", torrent.title);

  torrent.guid = utilService.generateGuid();
  return existingTorrentPromise
         .then(torrentService.startNewTorrentOrFail(torrent));
}

torrentService.startNewTorrentOrFail = function(newTorrent) {
  return function(existingTorrent) {
    // The promise chain return the downloading torrent
    if (existingTorrent == null ||
        (existingTorrent !== null && existingTorrent.state == TorrentState.AWAITING_DOWNLOAD) ||
        (existingTorrent !== null && existingTorrent.state == TorrentState.NEW)) {

        log.debug("No existing torrent, starting and persisting now: ", newTorrent.torrentFileLink);
        return torrentService.setAsDownloading(newTorrent);
    } else {

      log.debug("Torrent exists, checking state ", existingTorrent);
      if (existingTorrent.state === null) {
        return transactionUtilsService
               .executeInTransactionWithResult(deleteAndRestartTorrentChain(existingTorrent, newTorrent));
      } else {
        // This torrent is already downloading or terminated
        var msg = "The provided torrent is already downloading or finished (duplicate): " + existingTorrent.torrentName;
        torrentService.updateTorrentsStatus();
        log.error(msg);
        throw { name: 'DUPLICATE_TORRENT', message: msg, status: 400};
      }
    }
  }
}

torrentService.delete = function(torrentHash) {
  return Torrent.destroy({hash: torrentHash});
}

torrentService.deleteTorrent = function(torrentHash, deleteInTransmission) {
  if (!deleteInTransmission) {
     return torrentService.delete(torrentHash);
  } else {
     return transmissionService.cancelTorrent(torrentHash).then(function() {
       return torrentService.delete(torrentHash);
     });
  }
}

torrentService.setAsDownloading = function(torrent) {
  torrent.state = TorrentState.DOWNLOADING;
  torrent.title = torrent.torrentName;
  var persistTorrentPromise = torrentService.persistTorrent(torrent);
  // This executes asynchronously
  transmissionService.startTorrent(torrent).then(function(response) {
    return torrentService.populateTorrentWithResponseData(response, torrent.guid);
  }).catch(handleErrorStartingTorrent(torrent));
  return persistTorrentPromise;
}

torrentService.populateTorrentWithResponseData = function(startTorrentResponse, guid) {
  if (startTorrentResponse === null) {
    return {error: "Duplicate torrent"};
  } else {
    var filePath = startTorrentResponse.filePath;
    var torrentResponse = startTorrentResponse.torrentResponse;
    var torrentName = torrentResponse.name.replace('+','.');
    torrentName = torrentName.replace(' ', '.');
    var torrentHash = torrentResponse.hashString;
    log.debug("Fetching with GUID: ", guid);
    return torrentService.findByGuid(guid).then(function(existingTorrent) {
      log.debug("Should have found a torrent with the GUID ", guid, " -- ", existingTorrent);
      return createOrUpdateTorrentData(existingTorrent, torrentHash, torrentName, filePath);
    });
  }
}

torrentService.saveTorrentWithState = function(torrent, torrentState) {
  torrent.state = torrentState;
  return torrentService.findByHash(torrent.hash).then(function(torrentFound) {
    if (torrentFound == null) {
      return torrentService.persistTorrent(torrent);
    } else {
      torrentFound.state = state;
      return torrentFound.save();
    }
  });
}

// -------------------------------- PRIVATE -----------------------------------

/**
* Returns a closure that is executed inside a transaction boundary.
* What it does is first deleting the existing torrent and then restarting and
* populating data in DB from the response.
*
*/
function deleteAndRestartTorrentChain(existingTorrent, currentTorrent) {
  return function(transaction) {
    var startTorrentAgain = function ()  {
      return transmissionService.startTorrent(currentTorrent);
    };

    return torrentService.deleteTorrent(existingTorrent, true)
                  .then(startTorrentAgain)
                  .then(torrentService.populateTorrentWithResponseData)
                  .catch(handleErrorStartingTorrent(currentTorrent));
  };
}

/**
* Torrent failed to start, we need to update to FAILED
*/
function handleErrorStartingTorrent(torrent) {
  return function() {
    log.error("An error occurred starting torrent ", torrent.guid, " -- marking as failed");
    torrent.state = TorrentState.FAILED;
    return torrentService.updateTorrent(torrent);
  }
}

function createOrUpdateTorrentData(existingTorrent, torrentHash, torrentName, filePath) {
  var torrent = {};
  torrent.hash = torrentHash;
  torrent.dateStarted = moment.utc().toDate();
  torrent.title = utilService.clearSpecialChars(torrentName);
  torrent.torrentName = utilService.clearSpecialChars(torrentName);
  torrent.filePath = filePath;
  torrent.state = TorrentState.DOWNLOADING;

  if (!torrent.torrentName) {
    torrent.torrentName = torrentName;
  }

  if (!torrent.title || torrent.title === "Unknown") {
    torrent.title = torrentName;
  }

  if (existingTorrent !== null) {
    _.extend(existingTorrent, torrent);
    log.debug("Found torrent already in database with hash ", torrentHash, " - ", torrentName);
    return torrentService.updateTorrent(existingTorrent);
  } else {
    torrent.guid = utilService.generateGuid();
    log.debug("Torrent not found, creating now");
    return torrentService.persistTorrent(torrent);
  }
}

function processSingleTorrentResponse(torrentResponse) {
	var torrentHash = torrentResponse.hashString;
  var findTorrent = torrentService.findByHash(torrentHash);
  return findTorrent.then(createOrUpdateTorrentClosure(torrentResponse, torrentHash));
}

function createOrUpdateTorrentClosure(torrentResponse, torrentHash) {
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
  var percentDone = 100 * torrentResponse.percentDone;
  existingTorrent.magnetLink = torrentResponse.magnetLink;
  var torrentName = existingTorrent.torrentName;
  var currentPercent = existingTorrent.percentDone;

  log.debug("[UPDATE-TORRENTS] Torrent response: ", torrentResponse.name,
            " is DOWNLOADING, state read is ", torrentState, ", ",
            percentDone, '%');
  log.debug("[UPDATE-TORRENTS] Torrent DB: ", torrentName, ' is ', torrentState,
            ' stored percentage is ', currentPercent);

  if (percentDone !== null && percentDone > 0 && percentDone < 100 &&
      currentPercent !== 100 &&
      torrentState !== TorrentState.DOWNLOAD_COMPLETED &&
      torrentState !== TorrentState.RENAMING &&
      torrentState !== TorrentState.RENAMING_COMPLETED &&
      torrentState !== TorrentState.FETCHING_SUBTITLES &&
      torrentState !== TorrentState.FAILED &&
      torrentState !== TorrentState.COMPLETED) {

      existingTorrent.percentDone = percentDone;

      if (torrentState !== TorrentState.DOWNLOADING && torrentState !== TorrentState.PAUSED) {
        existingTorrent.state = TorrentState.DOWNLOADING;
        log.debug("Torrent ", torrentName, " found in DB, setting as DOWNLOADING");
      }

  } else if (percentDone >= 100 && (torrentState == TorrentState.DOWNLOADING || torrentState == null || torrentState == '')) {

    existingTorrent.percentDone = 100;
    existingTorrent.state = TorrentState.DOWNLOAD_COMPLETED;
    existingTorrent.dateFinished = moment.utc().toDate(); //only dates in sequelize
    log.info("[UPDATE-TORRENTS] Torrent ", torrentName, " finished downloading -- DOWNLOAD_COMPLETED");
  }

  return existingTorrent.save().then(function(savedTorrent) {
    // Clear finished torrents from Transmission directly
    if (torrentState === TorrentState.COMPLETED) {
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
  var relocation = transmissionService
                   .relocateAndRestart(torrentResponse.name, torrentResponse.hashString)
                   .then(populateTorrentAfterRelocation(torrentResponse, torrent));
  return relocation;
}

function populateTorrentAfterRelocation(torrentResponse, torrent) {
  return function (newLocation) {
    var finished = false;
    var percentDone = 100 * torrentResponse.percentDone;
    torrent.filePath = newLocation;
    torrent.guid = torrent.guid || utilService.generateGuid();
    torrent.torrentName = torrentResponse.name;
    torrent.dateStarted = moment.utc().toDate();
    torrent.finished = false;

    if (percentDone > 0 && percentDone < 100) {
      torrent.state = TorrentState.DOWNLOADING;
      log.debug("[UPDATE-TORRENTS] Torrent ", torrent.torrentName,
                " set as DOWNLOADING, percentDone ",percentDone);
    } else if (percentDone == 100 || percentDone > 100) {
      torrent.state = TorrentState.DOWNLOAD_COMPLETED;
      torrent.percentDone = 100;
      log.info("[UPDATE-TORRENTS] Torrent ", torrent.torrentName, " finished downloading -- DOWNLOAD_COMPLETED");
      torrent.dateFinished = moment.utc().toDate();
      finished = true;
    }

    torrent.title = torrentResponse.name;
    torrent.hash = torrentResponse.hashString;
    torrent.contentType = null;
    torrent.percentDone = percentDone;
    torrent.magnetLink = torrentResponse.magnetLink;

		return torrentService.persistTorrent(torrent).then(function(persistedTorrent) {
      log.debug("Persisted torrent ", persistedTorrent);
      if (finished) {
        transmissionService.deleteTorrent()
      }
      return persistedTorrent;
    });
  }
}


module.exports = torrentService;
