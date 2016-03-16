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
var transactionUtilsService = require('./transactionUtilsService');

//TODO: investigate this to propagate all errors
// Promise.onPossiblyUnhandledRejection(function(error){
//     throw error;
// });

var torrentService = {}

torrentService.getCurrentStatus = function() {
  var upperDate = moment().utc().toDate();
  var lowerMoment = moment().utc();
  lowerMoment.subtract(2, 'weeks');
  var lowerDate = lowerMoment.toDate();

  // select t from torrent
  // where (dateStarted is not null and dateStarted between :lower and :upper)
  // or state != 'COMPLETED'
  var query = Torrent.findAll({
    where: {
      $or: {
        dateStarted: {
          $and: {
            $ne: null,
            $between: [lowerDate, upperDate]
          }
        },
        state: {
          $ne: 'COMPLETED'
        }
      }
    },
    order: [
      ['dateStarted', 'DESC']
    ]
  });

  return query;
}



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
  return torrentService.findByGuid(torrent.guid).then(mapAndUpdateTorrent(torrent));
}

torrentService.updateTorrentUsingHash = function(torrent) {
    log.debug("Searching hash ", torrent.hash);
    return torrentService.findByHash(torrent.hash).then(mapAndUpdateTorrent(torrent));
}

torrentService.pauseTorrent = function(torrentHash) {
  log.debug("About to pause: ", torrentHash);
	return transmissionService.pauseTorrent(torrentHash).then(function() {
    log.debug("Pausing torrent: ", torrentHash);
    var torrent = {};
    torrent.state = TorrentState.PAUSED;
    torrent.hash = torrentHash;
    return torrentService.updateTorrentUsingHash(torrent);
  });
}

torrentService.resumeTorrent = function(torrentHash) {
	return transmissionService.resumeTorrent(torrentHash).then(function() {
    var torrent = {};
    torrent.hash = torrentHash;
    log.debug("Resuming torrent: ", torrentHash);
	  torrent.state = TorrentState.DOWNLOADING;
    process.nextTick(function () {
      torrentService.updateTorrentsStatus();
    });
	  return torrentService.updateTorrentUsingHash(torrent);
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
    log.debug("[TORRENT-START] Starting download from torrent file: ", torrentFileLink);
    link = torrentFileLink;
  } else if (magnetLink) {
    existingTorrentPromise = torrentService.findTorrentByMagnetLink(torrent.magnetLink);
    log.debug("[TORRENT-START] Starting download from torrent magnet: ", magnetLink);
    link = magnetLink;
  }

  torrent.title = torrent.torrentName =
    torrent.title || torrent.torrentName || torrentUtilsService.getNameFromMagnetLinkOrTorrentFile(link);

  log.debug("[TORRENT-START] Torrent title: ", torrent.title);

  torrent.guid = utilService.generateGuid();
  log.debug("[TORRENT-START] Guid generated is: ", torrent.guid)
  return existingTorrentPromise
         .then(torrentService.startNewTorrentOrFail(torrent));
}

torrentService.startNewTorrentOrFail = function(newTorrent) {
  return function(existingTorrent) {
    // The promise chain return the downloading torrent
    if (existingTorrent == null ||
        (existingTorrent !== null && existingTorrent.state == TorrentState.AWAITING_DOWNLOAD) ||
        (existingTorrent !== null && existingTorrent.state == TorrentState.NEW)) {

        log.debug("[TORRENT-START] No existing torrent, starting and persisting now: ", newTorrent.torrentFileLink);
        return torrentService.setAsDownloading(newTorrent);
    } else {

      log.debug("[TORRENT-START] Torrent exists, checking state ", existingTorrent);
      if (existingTorrent.state === null) {
        return transactionUtilsService
               .executeInTransactionWithResult(deleteAndRestartTorrentChain(existingTorrent, newTorrent));
      } else {
        // This torrent is already downloading or terminated
        var msg = "The provided torrent is already downloading or finished (duplicate): " + existingTorrent.torrentName;
        if (existingTorrent.state === TorrentState.DOWNLOADING) {
          log.info("Torrent is already downloading with hash: ", existingTorrent.hash);
          torrentService.updateTorrentsStatus();
          return;
        } else {
          log.error("[TORRENT-START] ", msg);
          throw { name: 'DUPLICATE_TORRENT', message: msg, status: 400};
        }
      }
    }
  }
}

torrentService.delete = function(torrentHashOrGuid) {
  return Torrent.destroy(
                { where:
                  { $or: {
                     hash: torrentHashOrGuid,
                     guid: torrentHashOrGuid
                   }
                  }
                });
}

torrentService.findByHashOrGuid = (torrent) => {
  if (torrent.hash) {
    return torrentService.findByHash(torrent.hash);
  } else if (torrent.guid) {
    return torrentService.findByGuid(torrent.guid);
  } else {
    var msg = "Torrent hash or GUID is needed";
    log.error(msg);
    throw {name: "INVALID_TORRENT", message: msg, status: 400 };
  }
}

torrentService.deleteTorrent = function(torrentHash, deleteInTransmission) {
  if (!deleteInTransmission) {
     return torrentService.delete(torrentHash);
  } else {
     return transmissionService.cancelTorrent(torrentHash).then(function() {
       log.debug(" ======= CANCELLED IN TRANSMISSION ======");
       return torrentService.delete(torrentHash);
     });
  }
}

torrentService.setAsDownloading = function(torrent) {
  torrent.state = TorrentState.DOWNLOADING;
  torrent.title = torrent.torrentName;
  log.debug('[TORRENT-START] About to persist the starting torrent', torrent);
  var persistTorrentPromise = torrentService.persistTorrent(torrent);

  log.debug("[TORRENT-START] Launched transmission start in background");
  // This executes asynchronously
  transmissionService.startTorrent(torrent).then(function(response) {
    return torrentService.populateTorrentWithResponseData(response, torrent.guid);
  }).catch(handleErrorStartingTorrent(torrent));

  return persistTorrentPromise;
}

/**
* Find torrent with the given guid and update it with the response data from
* a transmission call
*/
torrentService.populateTorrentWithResponseData = function(startTorrentResponse, guid) {
  if (startTorrentResponse === null) {
    return {error: "Duplicate torrent"};
  } else {
    // Values coming from transmission start call
    var filePath = startTorrentResponse.filePath;
    var torrentResponse = startTorrentResponse.torrentResponse;

    var torrentName = torrentResponse.name.replace('+','.');
    torrentName = torrentName.replace(' ', '.');
    var torrentHash = torrentResponse.hashString;
    var percentDone = 100 * torrentResponse.percentDone;
    log.debug("[TORRENT-START-AFTER] Fetching with GUID: ", guid);
    return torrentService.findByGuid(guid).then(function(existingTorrent) {
      log.debug("[TORRENT-START-AFTER] Should have found a torrent with the GUID ", guid, " -- ", existingTorrent);
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
      torrentFound.state = torrentState;
      return torrentFound.save();
    }
  });
}

// -------------------------------- PRIVATE -----------------------------------

/**
*/
function mapAndUpdateTorrent(currentTorrent) {
  // The fulfilled value of the query is set in the then() closure (this one)
  return function (storedTorrent) {
    if (storedTorrent === null) {
      log.debug("[TORRENT-UPDATE] Torrent not found -- aborting update");
      return null;
    } else {
      log.debug("[TORRENT-UPDATE] Updating torrent with GUID ", storedTorrent.guid);
      _.extend(storedTorrent, currentTorrent);
      return storedTorrent.save();
    }
  }
}

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

    //TODO: stale call, functions changed signatures, FIX
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
  return function(error) {
    log.error("An error occurred starting torrent ", torrent.guid, " -- marking as failed: ", error);
    torrent.state = TorrentState.FAILED;
    //TODO: throw the error as well, so the API layer picks it
    return torrentService.updateTorrent(torrent);
  }
}

function createOrUpdateTorrentData(existingTorrent, torrentHash, torrentName, filePath, percentDone) {
  var torrent = {};

  log.debug("[TORRENT-START-AFTER] Generating torrent from response with hash: ", torrentHash);

  torrent.hash = torrentHash;
  torrent.dateStarted = moment.utc().toDate();
  torrent.title = utilService.clearSpecialChars(torrentName);
  torrent.torrentName = utilService.clearSpecialChars(torrentName);
  torrent.filePath = filePath;
  torrent.state = TorrentState.DOWNLOADING;
  torrent.percentDone = 0;

  if (existingTorrent !== null) {
    log.debug("[TORRENT-START-AFTER] Before: ", existingTorrent);
    _.extend(existingTorrent, torrent);
    log.debug("[TORRENT-START-AFTER] After: ", existingTorrent);
    log.debug("[TORRENT-START-AFTER] Found torrent already in database, updating with hash ",
              existingTorrent.hash, " - ", torrentName);
    return existingTorrent.save();
  } else {
    torrent.guid = utilService.generateGuid();
    log.warn("[TORRENT-START-AFTER] Warning! Torrent not found -- creating now");
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
      log.debug("Torrent does not exist in DB with hash: " + torrentHash + " -- transmission response should create it!");
      // The torrent could have been created with GUID only and still not getting update from transmission with a hash
      // return createAndRelocateTorrent(torrentResponse);
      return;
    } else {
      log.debug("Torrent exists: " + torrentHash + " -- updating");
      return updateExistingTorrentFromResponse(existingTorrent, torrentResponse);
    }
  }
}

function updateExistingTorrentFromResponse(existingTorrent, torrentResponse) {
  var torrentState = existingTorrent.state;
  log.debug(">>>>>>> percent in response is: ", torrentResponse.percentDone);
  var percent = 100 * torrentResponse.percentDone;
  log.debug(">>>>>>> Percent: ", percent);
  var percentDone = Math.round(100 * percent) / 100;
  log.debug(">>>>>>> PercentDone: ", percentDone);
  existingTorrent.magnetLink = torrentResponse.magnetLink;
  var torrentName = existingTorrent.torrentName;
  var currentPercent = existingTorrent.percentDone;

  // bytes to Mb
  var torrentSize = torrentResponse.totalSize || 0;
  var torrentSizeMb = Math.round( (torrentSize / 1024) / 1024);
  existingTorrent.size = existingTorrent.size || torrentSizeMb;

  log.debug("[UPDATE-TORRENTS] Torrent response for§: ", torrentResponse.name, percentDone, '%');
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

  } else if (percentDone >= 100 &&
             (torrentState == TorrentState.DOWNLOADING || torrentState == null
              || torrentState == '')) {

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

		return torrentService.persistTorrent(torrent);
  }
}


module.exports = torrentService;
