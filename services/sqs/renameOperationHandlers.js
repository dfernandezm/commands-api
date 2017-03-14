/**
 * Created by david on 11/03/2017.
 */
const debug = require("debug")("services/sqs:tvsterMessageService");
const sqsService = require("./sqsService");
const messageTypes = require("./messageTypes");
const workerService = require("../workerService");
const TorrentState = require('../torrentState');
const downloadOperationHandlers = require("./downloadOperationHandlers");
const Promise = require("bluebird");

const renameOperationHandlers = {};

// API: initiates a startRename
renameOperationHandlers.startRename = (torrents, mediaCenterSettings) => {
    let content = { torrents: torrents, mediacenterSettings: mediaCenterSettings };
    return sendRequestMessage(messageTypes.START_RENAME, content);
}

// Worker: notifies API about renaming completed
renameOperationHandlers.renameCompleted = (renamedTorrents) => {
    let content = { renamedTorrents: renamedTorrents};
    return sendRequestMessage(messageTypes.RENAME_COMPLETED, content);
}

// Worker: starts a renaming process (if not already running, TODO)
renameOperationHandlers.handleStartRenameRequest = (messageContent) => {
    // Worker handles the start of the renaming process
    let statusResult;
    return workerService.startRename(messageContent.torrents, messageContent.mediacenterSettings).then((renamingTorrentsHashes) => {
        statusResult = "success";
        // List of renaming torrents
        debug("Renaming torrent hashes", renamingTorrentsHashes);
        let content = {renamingTorrentsHashes: renamingTorrentsHashes};
        return sendResponse(messageTypes.START_RENAME, content, statusResult);
    }).catch((error) => {
        statusResult = "failure";
        debug("Error starting renamer: ", error);
        let content = {error: error};
        return sendResponse(messageTypes.START_RENAME, content, statusResult);
    });
}

// API: executes this handler as a response from startRename
renameOperationHandlers.handleStartRenameResponse = (messageContent) => {
    debug("Received response for start rename", messageContent);
    const torrentService = require("../torrentService");
    if (messageContent.result === "success") {
        let renamingTorrentsHashes = messageContent.renamingTorrentsHashes;
        if (renamingTorrentsHashes) {
            return Promise.map(renamingTorrentsHashes, (torrentHash) => {
                return torrentService.setTorrentAsRenaming(torrentHash);
            }).then((results) => {
                debug("Updated torrents to renaming state", renamingTorrentsHashes)
            }).catch((err) => {
                debug("There was an error updating torrents", err);
            });
        } else {
            debug("Debug")
        }

    } else {
        //failure
        debug("Error starting rename process, torrents will be left untouched", JSON.stringify(messageContent.error));
    }
}

// The API handles a rename completed message (sets the torrent/s as RENAMING_COMPLETED) or back
// to DOWNLOAD_COMPLETED (the renamedTorrents collection comes from renameExecutor)
renameOperationHandlers.handleRenameCompleted = (messageContent) => {

    debug("Renamed torrents raw message %s", JSON.stringify(messageContent));
    const torrentService = require("../torrentService");
    let renamedTorrents = messageContent.renamedTorrents.renamedTorrents;
    let status = messageContent.renamedTorrents.status;

    for (let torrentHash in renamedTorrents) {
        if (renamedTorrents.hasOwnProperty(torrentHash)) {
            let torrentRenames = renamedTorrents[torrentHash];
            let torrent = {};

            if (status === "failure") {
                let torrent = {};
                torrent.hash = torrentHash;
                torrent.state = TorrentState.RENAMING_COMPLETED;
            } else {
                debug("Torrent hash %s", torrentHash);
                let renamedPaths = torrentRenames.map((rename) => {
                    return rename.renamedPath;
                });

                let separatedRenamedPaths = renamedPaths.join(";");

                debug("Torrent %s successfully renamed, setting as RENAMING_COMPLETED, renamed paths are %s", torrentHash, separatedRenamedPaths);
                torrent.hash = torrentHash;
                torrent.state = TorrentState.RENAMING_COMPLETED;
                torrent.renamedPath = separatedRenamedPaths;
            }

            torrentService.updateTorrentUsingHash(torrent).then(() => {
                if (torrent.state === TorrentState.RENAMING_COMPLETED) {
                    debug("Clearing RENAMING_COMPLETED torrent %s from tranmission");
                    return torrentService.cancelTorrentInTransmission(torrentHash);
                }
            });
        }
    }
}

// TODO: factor these functions
const sendRequestMessage = (messageType, messageContent) => {
    let messageToSend = { type: messageType,
        content: messageContent
    };
    return sqsService.sendMessage(messageToSend);
}

const sendResponse = (initiatorType, content, statusResult) => {
    content.result = statusResult;

    // Send a response message from the worker setting its initiator (the message type that generated this response)
    let messageToSend = {
        type: messageTypes.RESPONSE,
        initiator: initiatorType,
        content: content
    };

    return sqsService.sendMessage(messageToSend);
}

module.exports = renameOperationHandlers;
