/**
 * Created by david on 11/03/2017.
 */
const debug = require("debug")("services/sqs:tvsterMessageService");
const sqsService = require("./sqsService");
const messageTypes = require("./messageTypes");
const workerService = require("../workerService");
const TorrentState = require('../torrentState');
const Promise = require("bluebird");

const renameOperationHandlers = {};
renameOperationHandlers.startRename = (torrents, mediaCenterSettings) => {
    let messageToSend = { type: messageTypes.START_RENAME,
        content: { torrents: torrents, mediacenterSettings: mediaCenterSettings }
    };
    return sqsService.sendMessage(messageToSend);
}

// Worker notifies API about renaming completed
renameOperationHandlers.renameCompleted = (torrentsWithStatus) => {
    let messageToSend = { type: messageTypes.RENAME_COMPLETED,
        content: { renamedTorrents: torrentsWithStatus }
    };
    return sqsService.sendMessage(messageToSend);
}

// Executed on the worker
renameOperationHandlers.handleStartRenameRequest = (messageContent) => {
    // Worker handles the start of the renaming process
    let statusResult;
    return workerService.startRename(messageContent.torrents, messageContent.mediacenterSettings).then((renamingTorrentsHashes) => {
        statusResult = "success";
        debug(">>>>> Renaming torrent hashes", renamingTorrentsHashes);
        return sendStartRenameResponse({renamingTorrentsHashes, statusResult});
    }).catch((error) => {
        statusResult = "failure";
        debug("Error starting renamer: ", error);
        return sendStartRenameResponse({error, statusResult});
    });
}

// The API executes this handler as a response from startRename
renameOperationHandlers.handleStartRenameResponse = (messageContent) => {
    debug("Received response for start rename", messageContent);
    const torrentService = require("../torrentService");
    if (messageContent.result === "success") {
        let renamingTorrentHashes = messageContent.renamingTorrentHashes;
        if (renamingTorrentHashes) {
            return Promise.map(renamingTorrentHashes, (torrentHash) => {
                return torrentService.setTorrentAsRenaming(torrentHash);
            }).then((results) => {
                debug("Updated torrents to renaming state", renamingTorrentHashes)
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
// to DOWNLOAD_COMPLETED (the renamedTorrents collection comes from filebotExecutor)
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
                debug("Torrent %s successfully renamed, setting as RENAMING_COMPLETED", torrentHash);
                renamedPaths.push(completedRenameOrError.renamedPath);
                //TODO: Update renamed paths
            }
        }

        return torrentService.saveTorrentWithStateUsingHash(torrentHash, torrentState).catch(err => {
            debug("Error saving torrent %s state %s - %s", torrentHash, torrentState, JSON.stringify(err));
        });
    });
}

// Worker sends message back as a response to a START_RENAME
const sendStartRenameResponse = (responseObject) => {
    let content = {};
    if (responseObject.statusResult === "success") {
        content = {
            renamingTorrentsHashes: responseObject.renamingTorrentsHashes,
            result: responseObject.statusResult
        }
    } else {
        // Failure
        content = {
            error: responseObject.error,
            result: responseObject.statusResult
        }
    }

    // Send a response message from the worker setting it as a response to startRename
    let messageToSend = { type: messageTypes.RESPONSE,
        initiator: messageTypes.START_RENAME,
        content: content
    };

    return sqsService.sendMessage(messageToSend);
}

module.exports = renameOperationHandlers;
