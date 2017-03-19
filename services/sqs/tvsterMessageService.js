/**
 * Created by david on 02/03/2017.
 */
const debug = require("debug")("services/sqs:tvsterMessageService");
const sqsService = require("./sqsService");
const messageTypes = require("./messageTypes");
const utils = require("../utilService");
const downloadOperationHandlers =  require("./downloadOperationHandlers");
const workerOperationHandlers =  require("./workerOperationHandlers");
const workerOperationTypes = require("./helpers/workerOperationTypes");
const tvsterMessageService = {};

tvsterMessageService.getStatus = () => {
    return downloadOperationHandlers.getStatusFromTransmission();
}

tvsterMessageService.startDownload = (torrent) => {
   return downloadOperationHandlers.startDownload(torrent);
}

tvsterMessageService.pauseDownload = (torrentHash) => {
    return downloadOperationHandlers.pauseDownload(torrentHash);
}

tvsterMessageService.resumeDownload = (torrentHash) => {
    return downloadOperationHandlers.resumeDownload(torrentHash);
}

tvsterMessageService.cancelDownload = (torrentHash) => {
    return downloadOperationHandlers.cancelDownload(torrentHash);
}

tvsterMessageService.startRename = (torrents, mediaCenterSettings) => {
    return workerOperationHandlers.startWorkerOperation(torrents, mediaCenterSettings, workerOperationTypes.RENAME);
}

tvsterMessageService.renameCompleted = (result) => {
    return workerOperationHandlers.workerCompleted(result, workerOperationTypes.RENAME);
}

const workerMessageReceivedHandler = (rawMessage) => {
    let message = JSON.parse(rawMessage);
    switch (message.type) {
        case messageTypes.START_DOWNLOAD:
            downloadOperationHandlers.handleStartDownloadRequest(message.content);
            break;
        case messageTypes.PAUSE_DOWNLOAD:
            downloadOperationHandlers.handlePauseDownloadRequest(message.content);
            break;
        case messageTypes.RESUME_DOWNLOAD:
            downloadOperationHandlers.handleResumeDownloadRequest(message.content);
            break;
        case messageTypes.CANCEL_DOWNLOAD:
            downloadOperationHandlers.handleCancelDownloadRequest(message.content);
            break;
        case messageTypes.STATUS:
            downloadOperationHandlers.handleStatusRequest();
            break;
        case messageTypes.START_RENAME:
            workerOperationHandlers.handleStartWorkerRequest(message.content, workerOperationTypes.RENAME);
            break;
        default:
            debug("Message type not recognized: {} -- it will be ignored", message.type);
    }
}

const apiMessageReceivedHandler = (rawMessage) => {
    let message = JSON.parse(rawMessage);
    switch (message.type) {
        case messageTypes.RESPONSE:
            return handleAllResponseMessages(message);
        case messageTypes.RENAME_COMPLETED:
            return workerOperationHandlers.handleWorkerCompleted(message.content, workerOperationTypes.RENAME);
        default:
            debug("Message type not recognized: {} -- it will be ignored", message.type);
    }
}

const handleAllResponseMessages = (message) => {
    switch (message.initiator) {
        case messageTypes.START_DOWNLOAD:
            return downloadOperationHandlers.handleStartDownloadResponse(message.content);
        case messageTypes.PAUSE_DOWNLOAD:
            return downloadOperationHandlers.handlePauseDownloadResponse(message.content);
        case messageTypes.RESUME_DOWNLOAD:
            return downloadOperationHandlers.handleResumeDownloadResponse(message.content);
        case messageTypes.CANCEL_DOWNLOAD:
            return downloadOperationHandlers.handleCancelDownloadResponse(message.content);
        case messageTypes.STATUS:
            return downloadOperationHandlers.handleStatusResponse(message.content);
        case messageTypes.START_RENAME:
            return workerOperationHandlers.handleStartWorkerResponse(message.content, workerOperationTypes.RENAME);
        default:
            debug("Message initiator not recognized: {} -- it will be ignored", message.initiator);
            return {};
    }
}

tvsterMessageService.startListener = () => {
    if (utils.isWorker()) {
        debug("Initializing queue poller in Tvster Organizer Worker");
        sqsService.setupMessageConsumer(workerMessageReceivedHandler);
    } else {
        debug("Initializing queue poller in Tvster API");
        sqsService.setupMessageConsumer(apiMessageReceivedHandler);
    }
}

debug("About to start Listener");
tvsterMessageService.startListener();

module.exports = tvsterMessageService;