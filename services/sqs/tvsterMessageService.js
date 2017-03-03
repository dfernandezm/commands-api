/**
 * Created by david on 02/03/2017.
 */
const debug = require("debug")("services/sqs:tvsterMessageService");
const sqsService = require("./sqsService");
const messageTypes = require("./messageTypes");
const workerService = require("../workerService");

const utils = require("../utilService");

const tvsterMessageService = {};

tvsterMessageService.startDownload = (torrent) => {
    let messageToSend = { type: messageTypes.START_DOWNLOAD,
                         content: { torrent: torrent }
                        };
    return sqsService.sendMessage(messageToSend);
}

// Executed on the worker
const handleStartDownloadRequest = (messageContent) => {
    let torrent = messageContent.torrent;
    let statusResult;
    return workerService.startDownload(messageContent.torrent).then((response) => {
        statusResult = "success";
        return sendStartDownloadResponse({response, torrent, statusResult});
    }).catch((error) => {
        statusResult = "failure";
        return sendStartDownloadResponse({error, torrent, statusResult});
    });
}

// The worker sends this to the API
const sendStartDownloadResponse = (responseObject) => {
    let content = {};

    if (responseObject.statusResult === "success") {
        content = {
            response: responseObject.response,
            torrentGuid: responseObject.torrent.guid,
            result: responseObject.statusResult
        }
    } else {
        // Failure
        content = {
            torrent: responseObject.torrent,
            error: responseObject.error,
            result: responseObject.statusResult
        }
    }

    let messageToSend = { type: messageTypes.START_DOWNLOAD_RESPONSE,
                          content: content
                        };

    return sqsService.sendMessage(messageToSend);
}

// The API executes this handler as a response from startDownload
const handleStartDownloadResponse = (messageContent) => {
    debug("Received response for start download", messageContent);
    const torrentService = require("../torrentService");
    if (messageContent.result === "success") {
        return torrentService.populateTorrentWithResponseData(messageContent.response, messageContent.torrent.guid);
    } else {
        //failure
        debug("Typeeee", torrentService);
        return torrentService.handleStartingTorrentError(messageContent.torrent, messageContent.error);
    }
}

const workerMessageReceivedHandler = (rawMessage) => {
    let message = JSON.parse(rawMessage);
    switch (message.type) {
        case messageTypes.START_DOWNLOAD:
            handleStartDownloadRequest(message.content);
            break;
        default:
            debug("Message type not recognized: {} -- it will be ignored", message.type);
    }
}

const apiMessageReceivedHandler = (rawMessage) => {
    let message = JSON.parse(rawMessage);
    switch (message.type) {
        case messageTypes.START_DOWNLOAD_RESPONSE:
            handleStartDownloadResponse(message.content);
            break;
        default:
            debug("Message type not recognized: {} -- it will be ignored", message.type);
    }
}

tvsterMessageService.startListener = () => {
    if (utils.isWorker()) {
        debug("Inititalizing queue poller in WORKER");
        sqsService.setupMessageConsumer(workerMessageReceivedHandler);
    } else {
        debug("Inititalizing queue poller in API");
        sqsService.setupMessageConsumer(apiMessageReceivedHandler);
    }
}

tvsterMessageService.startListener();

module.exports = tvsterMessageService;