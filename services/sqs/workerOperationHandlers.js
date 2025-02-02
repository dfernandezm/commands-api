/**
 * Created by david on 11/03/2017.
 */
const debug = require("debug")("services/sqs:tvsterMessageService");
const sqsService = require("./sqsService");
const messageTypes = require("./messageTypes");
const workerService = require("../workerService");
const TorrentState = require('../torrentState');
const downloadOperationHandlers = require("./downloadOperationHandlers");
const messageHandlerHelpers = require("./helpers/messageHandlerHelper");
const workerOperationTypes = require("./helpers/workerOperationTypes");
const Promise = require("bluebird");
const log = require("../logger");

const workerOperationHandlers = {};

/**
 * API: initiates a startRename, startSubtitles
 */
workerOperationHandlers.startWorkerOperation = (torrents, mediaCenterSettings, workerOperationType) => {
    let content = {torrents: torrents, mediacenterSettings: mediaCenterSettings};
    let messageType = messageTypes.START_RENAME;

    if (workerOperationType === workerOperationTypes.SUBTITLES) {
        messageType = messageTypes.START_SUBTITLES;
    }

    return messageHandlerHelpers.sendRequestMessage(messageType, content);
}

// Worker: notifies API about renaming completed
workerOperationHandlers.workerCompleted = (result, workerOperationType) => {
    let content;
    let messageType;

    if (workerOperationType === workerOperationTypes.RENAME) {
        content = {renamedTorrents: result};
        messageType = messageTypes.RENAME_COMPLETED;
    }

    if (workerOperationType === workerOperationTypes.SUBTITLES) {
        content = {subtitlesResult: result};
        messageType = messageTypes.SUBTITLES_COMPLETED;
    }

    return messageHandlerHelpers.sendRequestMessage(messageType, content);
}

// Worker: starts a worker process (if not already running, TODO)
workerOperationHandlers.handleStartWorkerRequest = (messageContent, workerOperationType) => {
    // Worker handles the start of the worker process
    let workerOperation = workerService.startRename;
    let messageType = messageTypes.START_RENAME;

    if (workerOperationType === workerOperationTypes.SUBTITLES) {
        workerOperation = workerService.startSubtitles;
        messageType = messageTypes.START_SUBTITLES;
    }

    let statusResult;
    return workerOperation(messageContent.torrents, messageContent.mediacenterSettings).then((torrentsHashes) => {
        statusResult = "success";
        let content = {renamingTorrentsHashes: torrentsHashes};
        if (workerOperationType === workerOperationTypes.RENAME) {
            // List of renaming torrents
            log.info("Renaming torrent hashes", torrentsHashes);
        } else {
            log.info("Fetching Subtitles torrent hashes", torrentsHashes);
            content = {fetchingSubtitlesTorrentsHashes: torrentsHashes};
        }
        return messageHandlerHelpers.sendResponse(messageType, content, statusResult);
    }).catch((error) => {
        statusResult = "failure";
        log.error("Error starting renamer: ", error);
        let content = {error: JSON.stringify(error), torrents: messageContent.torrents};
        return messageHandlerHelpers.sendResponse(messageType, content, statusResult);
    });
}

// API: executes this handler as a response from startRename
workerOperationHandlers.handleStartWorkerResponse = (messageContent, workerOperationType) => {
    if (workerOperationType === workerOperationTypes.RENAME) {
        let json = JSON.stringify(messageContent);
        log.info("Received response for start rename: " + json);
    } else {
        log.info("Received response for start fetching subtitles", messageContent);
    }

    const torrentService = require("../torrentService");
    let fallbackState = TorrentState.DOWNLOAD_COMPLETED;
    if (messageContent.result === "success") {
        let torrentsHashes = messageContent.renamingTorrentsHashes;
        let successOperation = torrentService.setTorrentAsRenaming;
        if (workerOperationType === workerOperationTypes.SUBTITLES) {
            torrentsHashes = messageContent.fetchingSubtitlesTorrentsHashes;
            successOperation = torrentService.setTorrentAsFetchingSubtitles;
            fallbackState = TorrentState.RENAMING_COMPLETED;
        }
        if (torrentsHashes) {
            return Promise.map(torrentsHashes, (torrentHash) => {
                return successOperation(torrentHash);
            }).then(() => {
                debug("Updated torrents", torrentsHashes)
            }).catch((err) => {
                debug("There was an error updating torrents", err);
            });
        }
    } else {
        //failure
        log.warn("Error starting process, torrents will be left untouched", messageContent);
        messageContent.torrents.forEach((torrent) => {
            torrent.state = fallbackState;
            torrentService.updateTorrent(torrent);
        });
    }
}

const handleUpdatedTorrentsInApi = (torrent, workerOperationType, torrentService) => {
    return () => {

        if (torrent.state === TorrentState.RENAMING_COMPLETED && workerOperationType === workerOperationTypes.RENAME) {
            log.debug("Clearing RENAMING_COMPLETED torrent %s from tranmission");
            torrentService.cancelTorrentInTransmission(torrent.hash);
            torrentService.startSubtitlesIfNotInProgress();
        }

        // Either rename or subtitles processes failed (went to fallback state)
        if (torrent.state === TorrentState.RENAMING_COMPLETED && workerOperationType === workerOperationTypes.SUBTITLES ||
            torrent.state === TorrentState.DOWNLOAD_COMPLETED && workerOperationType === workerOperationTypes.RENAME) {
            // Subtitles are missing or incomplete or rename failed, to avoid continuous retry we cancel the poller
            torrentService.stopRenameAndSubtitlesInterval();

            // Continue requesting status
            torrentService.getCurrentStatus();
        }
    }
}

// The API handles a rename/subtitles completed message (sets the torrent/s as RENAMING_COMPLETED/COMPLETED) or back
// to DOWNLOAD_COMPLETED/RENAMING_COMPLETED (the collection comes from renameExecutor)
workerOperationHandlers.handleWorkerCompleted = (messageContent, workerOperationType) => {

    log.debug("Renamed/Subtitled torrents raw message %s", JSON.stringify(messageContent));
    const torrentService = require("../torrentService");

    let torrents;
    let status;
    let targetState;
    let fallbackState;

    if (workerOperationType === workerOperationTypes.RENAME) {
        torrents = messageContent.renamedTorrents.renamedTorrents;
        status = messageContent.renamedTorrents.status;
        targetState = TorrentState.RENAMING_COMPLETED;
        fallbackState = TorrentState.DOWNLOAD_COMPLETED;
    }

    if (workerOperationType === workerOperationTypes.SUBTITLES) {
        torrents = messageContent.subtitlesResult.subtitlesResult;
        log.debug("Status is " + messageContent.subtitlesResult.status);
        status = messageContent.subtitlesResult.status;
        targetState = TorrentState.COMPLETED;
        fallbackState = TorrentState.RENAMING_COMPLETED;
    }

    for (let torrentHash in torrents) {
        if (torrents.hasOwnProperty(torrentHash)) { // As we are iterating over object properties which include generic ones
            let torrent = {};
            log.info("Torrent hash %s", torrentHash);

            if (!status) {
                try {
                    status = torrents[torrentHash].status;
                } catch (err) {
                    log.warn("Error getting status",err);
                }
            }

            if (status && status === "failure") {
                torrent.hash = torrentHash;
                torrent.state = fallbackState;
                log.warn("Failure detected it will fallback to %s, it will retry, error %s", fallbackState, JSON.stringify(messageContent));
            } else {
                torrent.hash = torrentHash;

                if (workerOperationType === workerOperationTypes.RENAME) {
                    let torrentRenames = torrents[torrentHash];

                    if (torrentRenames.length == 0) {
                        log.warn("Not found renames for torrent hash ", torrentHash,  " -- fallback to ", fallbackState);
                        torrent.state = fallbackState;
                    } else {
                        let renamedPaths = torrentRenames.map(rename => rename.renamedPath);
                        let separatedRenamedPaths = renamedPaths.join(";");
                        log.info("Torrent %s successfully renamed, setting as RENAMING_COMPLETED, renamed paths are %s", torrentHash, separatedRenamedPaths);
                        torrent.renamedPath = separatedRenamedPaths;
                        torrent.state = targetState;
                    }
                } else {
                    let subtitledPaths = torrents[torrentHash];

                    let areAllSubtitled = false;

                    if (subtitledPaths) {
                        areAllSubtitled = subtitledPaths.reduce((acc, item) => {
                            log.info("Subtitled path %s - %s", item.singlePath, item.subtitleForPath);
                            return acc && item.subtitleForPath;
                        }, true);
                    } else {
                        log.warn("No subtitled paths returned %o", subtitledPaths);
                    }

                    if (!areAllSubtitled) {
                        log.warn("There are some paths with missing subtitles, setting back as RENAMING_COMPLETED");
                        torrent.state = fallbackState;
                    } else {
                        log.info("Torrent %s got subtitles, setting as COMPLETED", torrentHash);
                        torrent.state = targetState;
                    }
                }
            }

            torrentService.updateTorrentUsingHash(torrent).then(handleUpdatedTorrentsInApi(torrent, workerOperationType, torrentService));
        }
    }
}

module.exports = workerOperationHandlers;
