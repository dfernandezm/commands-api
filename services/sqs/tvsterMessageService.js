/**
 * Created by david on 02/03/2017.
 */
const debug = require("debug")("services/sqs:tvsterMessageService");
const log = require("../logger");
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

tvsterMessageService.startSubtitles = (torrents, mediaCenterSettings) => {
    return workerOperationHandlers.startWorkerOperation(torrents, mediaCenterSettings, workerOperationTypes.SUBTITLES);
}

tvsterMessageService.renameCompleted = (result) => {
    return workerOperationHandlers.workerCompleted(result, workerOperationTypes.RENAME);
}

tvsterMessageService.subtitlesCompleted = (result) => {
    return workerOperationHandlers.workerCompleted(result, workerOperationTypes.SUBTITLES);
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
        case messageTypes.START_SUBTITLES:
            workerOperationHandlers.handleStartWorkerRequest(message.content, workerOperationTypes.SUBTITLES);
            break;
        default:
            log.warn("Message type not recognized: {} -- it will be ignored", message.type);
            return {};
    }
}

const apiMessageReceivedHandler = (rawMessage) => {
    let message = JSON.parse(rawMessage);
    switch (message.type) {
        case messageTypes.RESPONSE:
            return handleAllResponseMessages(message);
        case messageTypes.RENAME_COMPLETED:
            return workerOperationHandlers.handleWorkerCompleted(message.content, workerOperationTypes.RENAME);
        case messageTypes.SUBTITLES_COMPLETED:
            return workerOperationHandlers.handleWorkerCompleted(message.content, workerOperationTypes.SUBTITLES);
        default:
            log.warn("Message type not recognized: {} -- it will be ignored", message.type);
            return {};
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
        case messageTypes.START_SUBTITLES:
            return workerOperationHandlers.handleStartWorkerResponse(message.content, workerOperationTypes.SUBTITLES);
        default:
            debug("Message initiator not recognized: {} -- it will be ignored", message.initiator);
            return {};
    }
}

tvsterMessageService.startListener = () => {
    if (utils.isWorker()) {
        log.info("Initializing queue poller in Tvster Organizer Worker");
        sqsService.setupMessageConsumer(workerMessageReceivedHandler);
    } else {
        log.info("Initializing queue poller in Tvster API");
        sqsService.setupMessageConsumer(apiMessageReceivedHandler);
    }
}

tvsterMessageService.startListener();

module.exports = tvsterMessageService;