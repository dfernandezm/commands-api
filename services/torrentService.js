"use strict";

const log = require('./logger');
const transmissionService = require('./transmissionService');
const utilService = require('./utilService');
const Torrent = require('../models').torrent;
const TorrentState = require('./torrentState');
const Promise = require('bluebird');
const moment = require('moment');
const _ = require('lodash');
const torrentUtilsService = require('./torrentUtilsService');
const transactionUtilsService = require('./transactionUtilsService');
const filebotService = require('./filebotService');
const tvsterMessageService = require("./sqs/tvsterMessageService");
const settingsService = require('./settingsService');
const cacheService = require("./cache/cacheService");

const torrentService = {};

const checkStatusInNextTick = () => {
    process.nextTick(function () {
        torrentService.updateTorrentsStatus();
    });
}

const requestStatus = () => {
    return tvsterMessageService.getStatus();
}

const isRenameCheckCancelled = () => {
    return cacheService.get(cacheService.keys.CANCELLED_STATUS_POLLER_KEY) !== null;
}

torrentService.getCurrentStatus = function () {
    let upperDate = moment().utc().toDate();
    let lowerMoment = moment().utc();
    lowerMoment.subtract(2, 'weeks');
    let lowerDate = lowerMoment.toDate();

    if (!isRenameCheckCancelled()) {
        utilService.startNewInterval("renameCheck", renameCheck, 5000);
    }

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

torrentService.updateTorrentsStatus = () => {
    utilService.startNewInterval("torrentsStatus",  requestStatus, 5000);
};

// In response to a STATUS request
torrentService.updateDbWithTorrentDataFromTransmission = function (torrentsResponse) {
    if (torrentsResponse.length == 0) {
        log.debug("Torrent response from transmission is empty -- no torrents added or downloading");
        utilService.stopInterval("torrentsStatus");
    } else {
        // Do not return promise on purpose as caller won't wait for it to settle
        Promise.map(torrentsResponse, function (oneTorrentResponse) {
            // Promise.map awaits for returned promises as well.
            log.debug("Processing response for torrent hash: ", oneTorrentResponse.hashString);
            return processSingleTorrentResponse(oneTorrentResponse);
        });
    }
}

torrentService.findByHash = function (torrentHash) {
    //noinspection JSUnresolvedFunction
    return Torrent.findOne({where: {hash: torrentHash}}); // returns the torrent found or null
}

torrentService.stopTorrentsStatus = function () {
    utilService.stopInterval('torrentsStatus');
}

torrentService.persistTorrent = function (torrent) {
    return Torrent.create(torrent);
}

torrentService.updateTorrent = function (torrent) {
    return torrentService.findByGuid(torrent.guid).then(mapAndUpdateTorrent(torrent));
}

torrentService.updateTorrentUsingHash = function (torrent) {
    return torrentService.findByHash(torrent.hash).then(mapAndUpdateTorrent(torrent));
}

torrentService.pauseTorrent = function (torrentHash) {
    return tvsterMessageService.pauseDownload(torrentHash);
}

torrentService.setTorrentAsPaused = (torrentHash) => {
    return torrentService.saveTorrentWithStateUsingHash(torrentHash, TorrentState.PAUSED);
}

torrentService.setTorrentAsDownloading = (torrentHash) => {
    return torrentService.saveTorrentWithStateUsingHash(torrentHash, TorrentState.DOWNLOADING);
}

torrentService.resumeTorrent = function (torrentHash) {
    return tvsterMessageService.resumeDownload(torrentHash);
}

torrentService.findTorrentByFileLink = function (fileLink) {
    return Torrent.findOne({where: {torrentFileLink: fileLink}});
}

torrentService.findByGuid = function (guid) {
    return Torrent.findOne({where: {guid: guid}});
}

torrentService.findTorrentByMagnetLink = function (magnetLink) {
    return Torrent.findOne({where: {magnetLink: magnetLink}});
}

torrentService.startTorrentDownload = function (torrent) {
    let existingTorrentPromise = {};
    let torrentFileLink = torrent.torrentFileLink;
    let magnetLink = torrent.magnetLink;
    let link = null;

    if (torrentFileLink) {
        existingTorrentPromise = torrentService.findTorrentByFileLink(torrent.torrentFileLink);
        log.info("Starting torrent download from torrent file: ", torrentFileLink);
        link = torrentFileLink;
    } else if (magnetLink) {
        existingTorrentPromise = torrentService.findTorrentByMagnetLink(torrent.magnetLink);
        log.info("Starting download from torrent magnet: ", magnetLink);
        link = magnetLink;
    }

    torrent.title = torrent.torrentName =
        torrent.title || torrent.torrentName || torrentUtilsService.getNameFromMagnetLinkOrTorrentFile(link);

    log.info("Torrent title: ", torrent.title);

    torrent.guid = utilService.generateGuid();
    return existingTorrentPromise
        .then(torrentService.startNewTorrentOrFail(torrent));
}

torrentService.startNewTorrentOrFail = (newTorrent) => {
    return function (existingTorrent) {
        // The promise chain returns the downloading torrent
        if (existingTorrent == null ||
            (existingTorrent !== null && existingTorrent.state == TorrentState.AWAITING_DOWNLOAD) ||
            (existingTorrent !== null && existingTorrent.state == TorrentState.NEW)) {

            log.debug("No existing torrent, starting and persisting now: ", newTorrent.torrentFileLink);
            checkStatusInNextTick();
            return torrentService.startDownloadInTransmission(newTorrent);
        } else {
            log.debug("Torrent exists, checking state ", existingTorrent);
            // This torrent is already downloading or terminated
            let msg = "The provided torrent is already downloading or finished (duplicate): " + existingTorrent.torrentName;
            if (existingTorrent.state === TorrentState.DOWNLOADING) {
                log.warn("Torrent is already downloading with hash: ", existingTorrent.hash);
            } else {
                log.error("[TORRENT-START] ", msg);
                throw {name: 'DUPLICATE_TORRENT', message: msg, status: 400};
            }
        }
    }
};

torrentService.delete = function (torrentHashOrGuid) {
    return Torrent.destroy({
            where: {
                $or: {
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
        const msg = "Torrent hash or GUID is needed";
        log.error(msg);
        throw {name: "INVALID_TORRENT", message: msg, status: 400};
    }
};

torrentService.deleteTorrent = function (torrentHash, deleteInTransmission) {
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

    log.debug('About to persist the starting torrent', torrent);
    torrentService.persistTorrent(torrent); // Not waiting for it

    log.debug("Sending message to start download");
    return tvsterMessageService.startDownload(torrent);
};

/**
 * Find torrent with the given guid and update it with the response data from
 * a Transmission call
 */
torrentService.populateTorrentWithResponseData = function (startTorrentResponse, guid) {
    if (startTorrentResponse === null) {
        return {error: "Duplicate torrent"};
    } else {
        // Values coming from transmission start call
        let filePath = startTorrentResponse.filePath;
        let torrentResponse = startTorrentResponse.torrentResponse;
        let torrentName = torrentResponse.name.replace('+', '.');
        torrentName = torrentName.replace(' ', '.');
        let torrentHash = torrentResponse.hashString;
        let percentDone = 100 * torrentResponse.percentDone;
        log.debug("Fetching torrent with GUID: " + guid);
        return torrentService.findByGuid(guid).then(function (existingTorrent) {
            log.debug("Found torrent with GUID ", guid, " -- ", existingTorrent);
            return createOrUpdateTorrentData(existingTorrent, torrentHash, torrentName, filePath, percentDone);
        });
    }
}

torrentService.saveTorrentWithState = function (torrent, torrentState) {
    return torrentService.findByHash(torrent.hash).then((torrentFound) => {
        if (torrentFound === null) {
            return torrentService.persistTorrent(torrent);
        } else {
            torrentFound.state = torrentState;
            return torrentFound.save();
        }
    });
}

torrentService.saveTorrentWithStateUsingHash = function (torrentHash, torrentState) {
    return torrentService.findByHash(torrentHash).then(function (torrentFound) {
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
    return function (error) {
        log.error("Error occurred starting torrent " + torrent.hash, error);
        return torrentService.handleStartingTorrentError(torrent, error);
    }
}

torrentService.handleStartingTorrentError = (torrent, error) => {
    log.error("An error occurred starting torrent ", torrent.guid, " -- marking as failed: ", error);
    torrent.state = TorrentState.FAILED;
    return torrentService.updateTorrent(torrent).then(() => {throw error;});
}

// --------------------------------------- PRIVATE -----------------------------------

const mapAndUpdateTorrent = (currentTorrent) => {

    // The fulfilled value of the query is set in the then() closure from the caller (this one)
    return function (storedTorrent) {
        if (storedTorrent === null) {
            log.warn("Torrent not found -- aborting update");
            return null;
        } else {
            log.debug("Updating torrent with GUID ", storedTorrent.guid);
            // Put currentTorrent on top of storedTorrent
            _.extend(storedTorrent, currentTorrent);
            return storedTorrent.save();
        }
    }
};

function createOrUpdateTorrentData(existingTorrent, torrentHash, torrentName, filePath, percentDone) {
    let torrent = {};

    log.debug("Generating torrent from response with hash: ", torrentHash);

    torrent.hash = torrentHash;
    torrent.dateStarted = moment.utc().toDate();
    torrent.title = utilService.clearSpecialChars(torrentName);
    torrent.torrentName = utilService.clearSpecialChars(torrentName);
    torrent.filePath = filePath;
    torrent.state = TorrentState.DOWNLOADING;
    torrent.percentDone = 0;

    if (existingTorrent !== null) {
        _.extend(existingTorrent, torrent);
        log.debug(" Found torrent already in database, updating with hash ",
            existingTorrent.hash, " - ", torrentName);
        return existingTorrent.save();
    } else {
        torrent.guid = utilService.generateGuid();
        log.warn("Torrent not found -- creating now");
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

    let torrentState = existingTorrent.state;
    log.debug("Percent in Transmission response is: " + torrentResponse.percentDone);
    let percent = 100 * torrentResponse.percentDone;
    let percentDone = Math.round(100 * percent) / 100;
    log.debug("Calculated percentage is " + percentDone);
    existingTorrent.magnetLink = torrentResponse.magnetLink;
    let torrentName = existingTorrent.torrentName;
    let currentPercent = existingTorrent.percentDone;

    // bytes to Mb
    let torrentSize = torrentResponse.totalSize || 0;
    let torrentSizeMb = Math.round((torrentSize / 1024) / 1024);
    existingTorrent.size = existingTorrent.size || torrentSizeMb;

    log.debug("Torrent percentage for ", torrentResponse.name, percentDone, '%');
    log.debug("Torrent in DB ", torrentName, ' is ', torrentState,
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
            log.debug("Torrent " + torrentName + " found in DB, setting as DOWNLOADING");
        }

    } else if (percentDone >= 100 &&
        (torrentState == TorrentState.DOWNLOADING || torrentState == null
        || torrentState == '')) {

        existingTorrent.percentDone = 100;
        existingTorrent.state = TorrentState.DOWNLOAD_COMPLETED;
        existingTorrent.dateFinished = moment.utc().toDate(); //only date objects are valid in sequelize
        log.debug("Torrent " + torrentName +  " finished downloading -- DOWNLOAD_COMPLETED");
    }

    return existingTorrent.save().then((savedTorrent) => {
        // Clear finished torrents from Transmission directly
        if (torrentState === TorrentState.RENAMING_COMPLETED || torrentState === TorrentState.COMPLETED) {
            log.debug("Torrent " + savedTorrent.hash + ": " + torrentState + " -- removing from Transmission");
            return torrentService.cancelTorrentInTransmission(savedTorrent.hash);
        }

        if (torrentState === TorrentState.DOWNLOAD_COMPLETED) {
            log.debug("Checking renamer...");
            renameCheck();
        }
    });
}

const renameCheck = () => {
    log.debug("Running renameCheck... ");
    return torrentService.findTorrentsWithState(TorrentState.RENAMING)
        .then(startRenamer);
}

const startRenamer = (renamingTorrents) => {
    if (renamingTorrents == null || renamingTorrents.length == 0) {
        log.debug("Checking if there are torrents to rename...");
        // Find torrents in DOWNLOAD_COMPLETED state
        return torrentService.findTorrentsWithState(TorrentState.DOWNLOAD_COMPLETED).then((torrents) => {
            if (torrents && torrents.length > 0) {
                //TODO: Cache the settings
                return settingsService.getDefaultMediacenterSettings().then(settings => {
                    return tvsterMessageService.startRename(torrents, settings);
                });
            } else {
                log.debug("There is no torrents to rename, checking subtitles");
                return torrentService.startSubtitlesIfNotInProgress();
            }
        });
    } else {
        log.warn("Torrents are already renaming" + renamingTorrents);
    }
}

const startFetchingSubtitles = (torrents) => {
    if (torrents && torrents.length > 0) {
        //TODO: Cache the settings
        return settingsService
            .getDefaultMediacenterSettings()
            .then(settings => {
                return tvsterMessageService
                    .startSubtitles(torrents, settings)
                    .then(() => { return torrents });
            });
    } else {
        log.debug("There is no torrents to fetch subtitles for");
        return [];
    }
};

const startSubtitlesIfEmptySet = (subtitlingTorrents) => {
    // If no subtitling ones, start
    if (!subtitlingTorrents || subtitlingTorrents.length == 0) {
        return torrentService
                .findTorrentsWithState(TorrentState.RENAMING_COMPLETED)
                .then(startFetchingSubtitles);
    } else {
        log.warn("Torrents are already in progress for subtitle fetching " + subtitlingTorrents);
        return [];
    }
};

torrentService.startSubtitlesIfNotInProgress = () => {
    return torrentService
        .findTorrentsWithState(TorrentState.FETCHING_SUBTITLES)
        .then(startSubtitlesIfEmptySet);
}

torrentService.fetchAllSubtitles = () => {
    return torrentService.startSubtitlesIfNotInProgress().then((subtitlingTorrents) => {
        if (subtitlingTorrents && subtitlingTorrents.length > 0) {
            subtitlingTorrents.forEach((torrent) => {
                torrentService.setTorrentAsFetchingSubtitles(torrent.hash);
            });
            torrentService.updateTorrentsStatus();
        }
    });
};

torrentService.rename = (torrentHash) => {
    return torrentService.findByHash(torrentHash).then(torrent => {
        if (torrent) {
            let torrents = [torrent];

            settingsService.getDefaultMediacenterSettings().then(settings => {
                return tvsterMessageService.startRename(torrents, settings);
            }).then(() => {
                torrentService.setTorrentAsRenaming(torrentHash);
            });
            torrent.state = TorrentState.RENAMING;
            torrentService.updateTorrentsStatus();
            return torrent;
        }
    });
}

torrentService.startRenamingAll = () => {
    renameCheck();
    torrentService.updateTorrentsStatus();
};

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

torrentService.setTorrentAsCompleted = (torrentHash) => {
    return torrentService.findByHash(torrentHash).then((torrent) => {
        torrent.state = TorrentState.COMPLETED;
        return torrent.save();
    });
}

torrentService.stopRenameAndSubtitlesInterval = () => {
    utilService.stopInterval("renameCheck");
    cacheService.writeToCache(cacheService.keys.CANCELLED_STATUS_POLLER_KEY, "true");
}

module.exports = torrentService;
