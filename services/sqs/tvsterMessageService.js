/**
 * Created by david on 02/03/2017.
 */
const debug = require("debug")("services/sqs:tvsterMessageService");
const sqsService = require("./sqsService");
const messageTypes = require("./messageTypes");
const utils = require("../utilService");
const downloadOperationHandlers =  require("./downloadOperationHandlers");
const renameOperationHandlers =  require("./renameOperationHandlers");
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

tvsterMessageService.startRename = (torrents, mediaCenterSettings) => {
    return renameOperationHandlers.startRename(torrents, mediaCenterSettings);
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
        case messageTypes.STATUS:
            downloadOperationHandlers.handleStatusRequest();
            break;
        case messageTypes.START_RENAME:
            //renameOperationHandlers.handleStartRenameRequest(message.content);
            return true;
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
            return renameOperationHandlers.handleRenameCompleted(message.content);
        default:
            debug("Message type not recognized: {} -- it will be ignored", message.type);
    }
}

const handleAllResponseMessages = (message) => {
    switch (message.initiator) {
        case messageTypes.START_DOWNLOAD:
            return downloadOperationHandlers.handleStartDownloadResponse(message.content);
            break;
        case messageTypes.PAUSE_DOWNLOAD:
            return downloadOperationHandlers.handlePauseDownloadResponse(message.content);
            break;
        case messageTypes.RESUME_DOWNLOAD:
            return downloadOperationHandlers.handleResumeDownloadResponse(message.content);
            break;
        case messageTypes.STATUS:
            return downloadOperationHandlers.handleStatusResponse(message.content);
            break;
        case messageTypes.START_RENAME:
            return renameOperationHandlers.handleStartRenameResponse(message.content);
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