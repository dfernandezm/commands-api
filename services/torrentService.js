"use strict";
var log = require('./logger');
var transmissionService = require('./transmissionService');
var utilService = require('./utilService');
var Torrent = require('../models').torrent;
var TorrentState = require('./torrentState');
var Promise = require('bluebird');
var moment = require('moment');
var _ = require('lodash');
var torrentUtilsService = require('./torrentUtilsService');
var transactionUtilsService = require('./transactionUtilsService');
var filebotService = require('./filebotService');
const tvsterMessageService = require("./sqs/tvsterMessageService");
var settingsService = require('./settingsService');

var torrentService = {};

torrentService.getCurrentStatus = function() {
  var upperDate = moment().utc().toDate();
  var lowerMoment = moment().utc();
  lowerMoment.subtract(2, 'weeks');
  var lowerDate = lowerMoment.toDate();

  process.nextTick(()=> {
      renameCheck();
  });
  // select t from torrent
  // where (dateStarted is not null and dateStarted between :lower and :upper)
  // or state != 'COMPLETED'
  return Torrent.findAll({
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
};

torrentService.updateTorrentsStatus = function() {
  utilService.startNewInterval('torrentsStatus', torrentService.requestStatus, 5000);
};

torrentService.updateDataForTorrentsOld = function() {
  log.debug("Updating torrents..");
  transmissionService.status().then(function(data) {
    var torrentsResponse = data.arguments.torrents;
    if (torrentsResponse.length == 0) {
      log.debug("Torrent response from transmission is empty -- no torrents added or downloading");
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

torrentService.requestStatus = () => {
    return tvsterMessageService.getStatus();
}

// In response to a STATUS request
torrentService.updateDbWithTorrentDataFromTransmission = function(torrentsResponse) {
    if (torrentsResponse.length == 0) {
        log.debug("Torrent response from transmission is empty -- no torrents added or downloading");
        utilService.stopInterval('torrentsStatus');
    } else {
        Promise.map(torrentsResponse, function(oneTorrentResponse) {
            // Promise.map awaits for returned promises as well.
            log.debug("Processing response for torrent hash: ", oneTorrentResponse.hashString);
            return processSingleTorrentResponse(oneTorrentResponse);
        });
    }
}


torrentService.findByHash = function(torrentHash) {
  //noinspection JSUnresolvedFunction
    return Torrent.findOne({ where: {hash: torrentHash} }); // returns the torrent found or null
}

torrentService.stopTorrentsStatus = function() {
  utilService.stopInterval('torrentsStatus');
}

torrentService.persistTorrent = function(torrent) {
  return Torrent.create(torrent);
}

torrentService.updateTorrent = function(torrent) {
  return torrentService.findByGuid(torrent.guid).then(mapAndUpdateTorrent(torrent));
}

torrentService.updateTorrentUsingHash = function(torrent) {
    return torrentService.findByHash(torrent.hash).then(mapAndUpdateTorrent(torrent));
}

torrentService.pauseTorrent = function(torrentHash) {
    return tvsterMessageService.pauseDownload(torrentHash);
}

torrentService.setTorrentAsPaused = (torrentHash) => {
    return torrentService.saveTorrentWithStateUsingHash(torrentHash, TorrentState.PAUSED);
}

torrentService.setTorrentAsDownloading = (torrentHash) => {
    return torrentService.saveTorrentWithStateUsingHash(torrentHash, TorrentState.DOWNLOADING);
}

torrentService.resumeTorrent = function(torrentHash) {
    log.debug("Resuming torrent: ", torrentHash);
    process.nextTick(function () {
        torrentService.updateTorrentsStatus();
    });
    return tvsterMessageService.resumeDownload(torrentHash);
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

torrentService.startTorrentDownload = function (torrent) {
    var existingTorrentPromise = {};
    var torrentFileLink = torrent.torrentFileLink;
    var magnetLink = torrent.magnetLink;
    var link = null;

    if (torrentFileLink) {
        existingTorrentPromise = torrentService.findTorrentByFileLink(torrent.torrentFileLink);
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
    log.debug("[TORRENT-START] Guid generated is: ", torrent.guid);
    return existingTorrentPromise
        .then(torrentService.startNewTorrentOrFail(torrent));
}

torrentService.startNewTorrentOrFail = (newTorrent) => {
    return function (existingTorrent) {
        // The promise chain return the downloading torrent
        if (existingTorrent == null ||
            (existingTorrent !== null && existingTorrent.state == TorrentState.AWAITING_DOWNLOAD) ||
            (existingTorrent !== null && existingTorrent.state == TorrentState.NEW)) {

            log.debug("[TORRENT-START] No existing torrent, starting and persisting now: ", newTorrent.torrentFileLink);
            return torrentService.startDownloadInTransmission(newTorrent);
        } else {
            log.debug("[TORRENT-START] Torrent exists, checking state ", existingTorrent);
            // This torrent is already downloading or terminated
            var msg = "The provided torrent is already downloading or finished (duplicate): " + existingTorrent.torrentName;
            if (existingTorrent.state === TorrentState.DOWNLOADING) {
                log.info("Torrent is already downloading with hash: ", existingTorrent.hash);
            } else {
                log.error("[TORRENT-START] ", msg);
                throw {name: 'DUPLICATE_TORRENT', message: msg, status: 400};
            }
        }
    }
};

torrentService.delete = function(torrentHashOrGuid) {
  return Torrent.destroy(
                { where:
                  { $or: {
                     hash: torrentHashOrGuid,
                     guid: torrentHashOrGuid
                   }
                  }
                });
};

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
};

torrentService.deleteTorrent = function(torrentHash, deleteInTransmission) {
  if (!deleteInTransmission) {
     return torrentService.delete(torrentHash);
  } else {
     return tvsterMessageService.cancelDownload(torrentHash).then(() => {
         // Deleting torrent in DB
         return torrentService.delete(torrentHash);
     });
  }
}

torrentService.cancelTorrentInTransmission = (torrentHash) => {
    return tvsterMessageService.cancelDownload(torrentHash);
}

torrentService.startDownloadInTransmission = function (torrent) {
    torrent.state = TorrentState.DOWNLOADING;
    torrent.title = torrent.torrentName;

    log.debug('[TORRENT-START] About to persist the starting torrent', torrent);
    torrentService.persistTorrent(torrent); // Not waiting for it

    log.debug("[TORRENT-START] Sending message to start");
    return tvsterMessageService.startDownload(torrent);
};

/**
* Find torrent with the given guid and update it with the response data from
* a Transmission call
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
      log.debug("[TORRENT-START-AFTER] Found torrent with GUID ", guid, " -- ", existingTorrent);
      return createOrUpdateTorrentData(existingTorrent, torrentHash, torrentName, filePath, percentDone);
    });
  }
}

torrentService.saveTorrentWithState = function(torrent, torrentState) {
  return torrentService.findByHash(torrent.hash).then(function(torrentFound) {
    if (torrentFound === null) {
      return torrentService.persistTorrent(torrent);
    } else {
      torrentFound.state = torrentState;
      return torrentFound.save();
    }
  });
}

torrentService.saveTorrentWithStateUsingHash = function(torrentHash, torrentState) {
    return torrentService.findByHash(torrentHash).then(function(torrentFound) {
        if (torrentFound !== null) {
            torrentFound.state = torrentState;
            return torrentFound.save();
        } else {
            log.warn("[WARNING] The torrent with hash ${torrentHash} does not exist");
        }
    });
};

torrentService.completeTorrentRename = function (torrentHash, renamedPathsAsString) {
    return torrentService.findByHash(torrentHash).then((torrent) => {
        torrent.renamedPath = renamedPathsAsString;
        torrent.state = TorrentState.RENAMING_COMPLETED;

        //TODO: Mark the job as completed
        return torrent.save();
    });
};

torrentService.findTorrentsWithState = (state) => {
    return Torrent.findAll({
        where: {
            state: state
        }
    });
};

/**
 * Torrent failed to start, we need to update to FAILED
 */
torrentService.handleErrorStartingTorrent = (torrent) => {
    return function(error) {
        return torrentService.handleStartingTorrentError(torrent, error);
    }
}

torrentService.handleStartingTorrentError = (torrent, error) => {
    log.error("An error occurred starting torrent ", torrent.guid, " -- marking as failed: ", error);
    torrent.state = TorrentState.FAILED;
    //TODO: throw the error as well, so the API layer picks it
    return torrentService.updateTorrent(torrent);
}

// --------------------------------------- PRIVATE -----------------------------------

const repeatRenameCheck = () => {
    if (utilService.getExecutions('renamer') < 10) {
        log.debug("[RENAMER] Scheduling new rename checker ...");
        utilService.increaseExecutions('renamer');
        setTimeout(getFilebotService().renameChecking, 5000);
    } else {
        log.debug("[RENAMER] Ending scheduler for rename checker");
    }
};

const mapAndUpdateTorrent = (currentTorrent) => {

    // The fulfilled value of the query is set in the then() closure from the caller (this one)
    return function (storedTorrent) {
        if (storedTorrent === null) {
            log.debug("[TORRENT-UPDATE] Torrent not found -- aborting update");
            return null;
        } else {
            log.debug("[TORRENT-UPDATE] Updating torrent with GUID ", storedTorrent.guid);
            // Put currentTorrent on top of storedTorrent
            _.extend(storedTorrent, currentTorrent);
            return storedTorrent.save();
        }
    }
};

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
                  .catch(torrentService.handleErrorStartingTorrent(currentTorrent));
  };
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
    let torrentHash = torrentResponse.hashString;
    return torrentService.findByHash(torrentHash)
                         .then(createOrUpdateTorrentClosure(torrentResponse, torrentHash));
}

function createOrUpdateTorrentClosure(torrentResponse, torrentHash) {
  return (existingTorrent) => {
    if (existingTorrent === null) {
      log.debug("Torrent does not exist in DB with hash: " + torrentHash + " -- transmission response should create it");
    } else {
      log.debug("Torrent exists: " + torrentHash + " -- updating");
      return updateExistingTorrentFromResponse(existingTorrent, torrentResponse);
    }
  }
}

function updateExistingTorrentFromResponse(existingTorrent, torrentResponse) {

    var torrentState = existingTorrent.state;
    log.debug(">>> Percent in response is: " + torrentResponse.percentDone);
    var percent = 100 * torrentResponse.percentDone;
    var percentDone = Math.round(100 * percent) / 100;
    log.debug("Calculated percent: " + percentDone);
    existingTorrent.magnetLink = torrentResponse.magnetLink;
    var torrentName = existingTorrent.torrentName;
    var currentPercent = existingTorrent.percentDone;

    // bytes to Mb
    var torrentSize = torrentResponse.totalSize || 0;
    var torrentSizeMb = Math.round((torrentSize / 1024) / 1024);
    existingTorrent.size = existingTorrent.size || torrentSizeMb;

    log.debug("[UPDATE-TORRENTS] Torrent response for: ", torrentResponse.name, percentDone, '%');
    log.debug("[UPDATE-TORRENTS] Torrent DB: ", torrentName, ' is ', torrentState,
        ' stored percentage is ', currentPercent);

    if (percentDone !== null && 
        percentDone > 0 && 
        percentDone < 100 &&
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
        existingTorrent.dateFinished = moment.utc().toDate(); //only date objects are valid in sequelize
        log.info("[UPDATE-TORRENTS] Torrent ", torrentName, " finished downloading -- DOWNLOAD_COMPLETED");
    }

    return existingTorrent.save().then((savedTorrent) => {
        // Clear finished torrents from Transmission directly
        if (torrentState === TorrentState.RENAMING_COMPLETED || torrentState === TorrentState.COMPLETED) {
            log.info("Torrent " + savedTorrent.hash + ": " + torrentState + " -- removing from Transmission");
            return torrentService.cancelTorrentInTransmission(savedTorrent.hash);
        }

        if (torrentState === TorrentState.DOWNLOAD_COMPLETED) {
            log.info("Checking renamer...");
            renameCheck();
        }
    });
}

const renameCheck = () => {
    log.debug("Running renameCheck... ");
    //TODO: enable when renamer ready
    return torrentService.findTorrentsWithState(TorrentState.RENAMING)
                         .then(startRenamer);
}

const startRenamer = (renamingTorrents) => {
    if (renamingTorrents == null || renamingTorrents.length == 0) {
        log.info("[RENAMER] Checking if there are torrents to rename...");
        // Find torrents in DOWNLOAD_COMPLETED state
        return torrentService.findTorrentsWithState(TorrentState.DOWNLOAD_COMPLETED).then((torrents) => {
            if (torrents && torrents.length > 0) {
                // Cache the settings
                return settingsService.getDefaultMediacenterSettings().then(settings => {
                    return tvsterMessageService.startRename(torrents, settings);
                });
            } else {
                log.info("[RENAMER] There is no torrents to rename");
                return null;
            }
        });
    } else {
        log.warn("Torrents are already renaming", renamingTorrents);
    }
}

torrentService.setTorrentAsRenaming = (torrentHash) => {
    return torrentService.findByHash(torrentHash).then((torrent) => {
        torrent.state = TorrentState.RENAMING;
        return torrent.save();
    });
}

torrentService.setTorrentAsFetchingSubtitles = (torrentHash) => {
    return torrentService.findByHash(torrentHash).then((torrent) => {
        torrent.state = TorrentState.FETCHING_SUBTITLES;
        return torrent.save();
    });
}

function getFilebotService() {
    return require('./filebotService');
}

module.exports = torrentService;
