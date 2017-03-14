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

// Worker: starts a renaming process (if not already running)
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
    let renamedTorrents = messageContent.renamedTorrents;
    const torrentService = require("../torrentService");
    let torrentState = TorrentState.RENAMING_COMPLETED;
    debug("Renamed torrents are", renamedTorrents);
    return Promise.map(Object.keys(renamedTorrents), (torrentHash) => {

        debug("Renamed torrent %s", torrentHash);

        let completedRenamesOrErrorForTorrent = renamedTorrents[torrentHash];
        let renamedPaths = [];
        for (let completedRenameOrError of completedRenamesOrErrorForTorrent) {
            if (completedRenameOrError.status === "error") {
                //Error - set back to DOWNLOAD_COMPLETED
                debug("Torrent %s failed renaming, setting back as DOWNLOAD_COMPLETED", torrentHash);
                torrentState = TorrentState.DOWNLOAD_COMPLETED;
                break;
            } else {
                //TODO: Handle multiple file torrent
                //TODO: Update renamed paths
                debug("Torrent %s successfully renamed, setting as RENAMING_COMPLETED", torrentHash);
                renamedPaths.push(completedRenameOrError.renamedPath);
            }
        }

        return torrentService.saveTorrentWithStateUsingHash(torrentHash, torrentState).catch(err => {
            debug("Error saving torrent %s state %s - %s", torrentHash, torrentState, JSON.stringify(err));
        });
    });
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
