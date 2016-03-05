var log = require('./logger');
var transmissionService = require('./transmissionService');
var utilService = require('./utilService');
var Torrent = require('../models').torrent;
var TorrentState = require('./torrentState');
var Promise = require('bluebird');
var utilService = require('./utilService');
var moment = require('moment');
var _ = require('lodash');

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
  return torrentService.findByHash(torrent.hash).then(function(currentTorrent) {
    log.debug("Updating torrent: ", torrent.hash);
    _.extend(currentTorrent, torrent);
    return currentTorrent.save();
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

torrentService.findTorrentByMagnetLink= function(magnetLink) {
  return Torrent.findOne({ where: {magnetLink: magnetLink} });
}


torrentService.startTorrentDownload = function(torrent) {

		var existingTorrentPromise = {};
    var torrentFileLink = torrent.torrentFileLink
    var magnetLink = torrent.magnetLink;

    if (torrentFileLink) {
      existingTorrentPromise = torrentService.findTorrentByFileLink(torrent.torrentFileLink)
      log.debug("[TORRENT-API] Starting download from torrent file: ", torrentFileLink)
    } else if (magnetLink) {
      existingTorrentPromise = torrentService.findTorrentByMagnetLink(torrent.magnetLink);
      log.debug("[TORRENT-API] Starting download from torrent magnet: ", magnetLink);
    }

    return existingTorrentPromise.then(function(existingTorrent) {
      // The promise chains return the downloading torrent
      if (existingTorrent == null ||
          (existingTorrent !== null && existingTorrent.state == TorrentState.AWAITING_DOWNLOAD) ||
          (existingTorrent !== null && existingTorrent.state == TorrentState.NEW)) {

          log.debug("No existing torrent, starting and persisting now: ", torrent.torrentFileLink);
          return transmissionService.startTorrent(torrent).then(function(response) {
             return torrentService.populateTorrentWithResponseData(response);
           });
      } else {
        log.debug("Torrent exists, checking state ", existingTorrent);
  			if (existingTorrent.state == null) {
          return transactionUtilsService.executeInTransactionWithResult(function(transaction) {

            return torrentService.deleteTorrent(existingTorrent, true).then(function() {
              torrent.guid = utilService.generateGuid();
              return transmissionService.startTorrent(torrent).then(function(response) {
                  return torrentService.populateTorrentWithResponseData(response);
              });
            });

          });

  			} else {
  				// This torrent is already downloading or terminated
          log.error("The provided torrent is already downloading or finished (duplicate): ", existingTorrent.torrentName);
  				return null;
  			}
  		}
    });
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


torrentService.populateTorrentWithResponseData = function(startTorrentResponse) {
      if (startTorrentResponse == null) {
        return {error: "Duplicate torrent"};
      } else {
        var filePath = startTorrentResponse.filePath;
        var torrentResponse = startTorrentResponse.torrentResponse;
        var torrentName = torrentResponse.name.replace('+','.');
        torrentName = torrentName.replace(' ', '.');
        var torrentHash = torrentResponse.hashString;
        return torrentService.findByHash(torrentHash).then(function(existingTorrent) {
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

// ----- PRIVATE ------------------------------------------------

function createOrUpdateTorrentData(existingTorrent, torrentHash, torrentName, filePath) {
  var torrent = {};
  if (existingTorrent !== null) {
    torrent = existingTorrent;
    log.debug("Found torrent already in database with hash ", torrentHash, " - ", torrentName);
  } else {
    torrent.guid = utilService.generateGuid();
    log.debug("Torrent not found, creating now");
  }
  torrent.hash = torrentHash;
  torrent.dateStarted = moment.utc().toDate();

  if (!torrent.torrentName) {
    torrent.torrentName = torrentName;
  }

  if (!torrent.title || torrent.title === "Unknown") {
    torrent.title = torrentName;
  }

  torrent.title = utilService.clearSpecialChars(torrent.title);
  torrent.torrentName = utilService.clearSpecialChars(torrent.torrentName);
  torrent.filePath = filePath;
  log.debug("Saving torrent in state DOWNLOADING");
  torrent.state = TorrentState.DOWNLOADING;
  return torrentService.persistTorrent(torrent, TorrentState.DOWNLOADING);
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
    torrent.torrentName = torrentResponse.name;
    torrent.dateStarted = moment.utc().toDate();
    torrent.finished = false;

    if (percentDone > 0 && percentDone < 100) {
      torrent.state = TorrentState.DOWNLOADING;
      log.debug("[UPDATE-TORRENTS] Torrent ", torrent.torrentName,
                " set as DOWNLOADING, percentDone ",percentDone);
    } else if (percentDone == 100) {
      torrent.state = TorrentState.DOWNLOAD_COMPLETED;
      log.info("[UPDATE-TORRENTS] Torrent ", torrent.torrentName, " finished downloading -- DOWNLOAD_COMPLETED");
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
