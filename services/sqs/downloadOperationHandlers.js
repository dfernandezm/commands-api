/**
 * Created by david on 11/03/2017.
 */
const debug = require("debug")("services/sqs:downloadOperationHandlers");
const sqsService = require("./sqsService");
const messageTypes = require("./messageTypes");
const workerService = require("../workerService");
const downloadOperationHandlers = {};

downloadOperationHandlers.startDownload = (torrent) => {
    let messageToSend = { type: messageTypes.START_DOWNLOAD,
        content: { torrent: torrent }
    };
    return sqsService.sendMessage(messageToSend);
}

downloadOperationHandlers.pauseDownload = (torrentHash) => {
    return sendRequestMessage(messageTypes.PAUSE_DOWNLOAD, { torrentHash: torrentHash });
}

downloadOperationHandlers.resumeDownload = (torrentHash) => {
    return sendRequestMessage(messageTypes.RESUME_DOWNLOAD, { torrentHash: torrentHash });
}

downloadOperationHandlers.cancelDownload = (torrentHash) => {
    return sendRequestMessage(messageTypes.CANCEL_DOWNLOAD, { torrentHash: torrentHash });
}


downloadOperationHandlers.getStatusFromTransmission = () => {
   return sendRequestMessage(messageTypes.STATUS, {});
}

// Executed on the worker
downloadOperationHandlers.handleStartDownloadRequest = (messageContent) => {
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

// On the worker, pause the torrent, and send response back to API
downloadOperationHandlers.handlePauseDownloadRequest = (messageContent) => {
    let torrentHash = messageContent.torrentHash;

    // function that when invoked decorates any result obtained with extra data to send in
    // then message content
    let successfulResponseGenerator = (pauseResult) => {
      pauseResult.torrentHash = torrentHash;
      return pauseResult;
    };

    let successClosure = getResponseSuccessClosure(messageTypes.PAUSE_DOWNLOAD, successfulResponseGenerator);
    let errorClosure = getResponseErrorClosure(messageTypes.PAUSE_DOWNLOAD);
    return handleRequest(workerService.pauseDownload(torrentHash), successClosure, errorClosure);
}

// On API, handle response from worker after pausing
downloadOperationHandlers.handlePauseDownloadResponse = (messageContent) => {
    debug("Received response from Pause Download", messageContent);
    const torrentService = require("../torrentService");
    if (messageContent.result === "success") {
        return torrentService.setTorrentAsPaused(messageContent.torrentHash);
    } else {
        //failure
        debug("Could not pause torrent", messageContent.error);
    }
}

// On the worker, cancel the torrent, and send response back to API
downloadOperationHandlers.handleCancelDownloadRequest = (messageContent) => {
    let torrentHash = messageContent.torrentHash;

    // function that when invoked decorates any result obtained with extra data to send in
    // then message content
    let successfulResponseGenerator = (cancelResult) => {
        cancelResult.torrentHash = torrentHash;
        return cancelResult;
    };

    let successClosure = getResponseSuccessClosure(messageTypes.CANCEL_DOWNLOAD, successfulResponseGenerator);
    let errorClosure = getResponseErrorClosure(messageTypes.CANCEL_DOWNLOAD);
    return handleRequest(workerService.cancelDownload(torrentHash), successClosure, errorClosure);
}

// On API, handle response from worker after pausing
downloadOperationHandlers.handleCancelDownloadResponse = (messageContent) => {
    debug("Received response from Cancel Download", messageContent);
    const torrentService = require("../torrentService");
    if (messageContent.result === "success") {
        return torrentService.delete(messageContent.torrentHash);
    } else {
        // Failure
        debug("Could cancel torrent", messageContent.error);
    }
}


// Worker
downloadOperationHandlers.handleStatusRequest = () => {
    let statusResult;
    return workerService.getStatus().then((torrentsResponse) => {
        statusResult = "success";
        let content = {torrentsResponse: torrentsResponse};
        return sendResponse(messageTypes.STATUS, content, statusResult);
    }).catch((error) => {
        statusResult = "failure";
        return sendResponse(messageTypes.STATUS, {error}, statusResult);
    });
}

// API call this as a response from getStatus request
downloadOperationHandlers.handleStatusResponse = (messageContent) => {
    debug("Received response for status", messageContent);
    const torrentService = require("../torrentService");
    if (messageContent.result === "success") {
        return torrentService.updateDbWithTorrentDataFromTransmission(messageContent.torrentsResponse);
    } else {
        //failure
        debug("There was an error getting status %o", messageContent.error);
    }
}

// On the worker, resume the torrent, and send response back to API
downloadOperationHandlers.handleResumeDownloadRequest = (messageContent) => {
    let torrentHash = messageContent.torrentHash;

    // function that when invoked decorates any result obtained with extra data to send in
    // then message content
    let successfulResponseGenerator = (resumeResult) => {
        resumeResult.torrentHash = torrentHash;
        return resumeResult;
    };

    let successClosure = getResponseSuccessClosure(messageTypes.RESUME_DOWNLOAD, successfulResponseGenerator);
    let errorClosure = getResponseErrorClosure(messageTypes.RESUME_DOWNLOAD);
    return handleRequest(workerService.resumeDownload(torrentHash), successClosure, errorClosure);
}

// On API, handle response from worker after resuming
downloadOperationHandlers.handleResumeDownloadResponse = (messageContent) => {
    debug("Received response from Resume Download", messageContent);
    const torrentService = require("../torrentService");
    if (messageContent.result === "success") {
        return torrentService.setTorrentAsDownloading(messageContent.torrentHash);
    } else {
        //failure
        debug("Could not resume torrent", messageContent.error);
    }
}

// The API executes this handler as a response from startDownload
downloadOperationHandlers.handleStartDownloadResponse = (messageContent) => {
    debug("Received response for start download", messageContent);
    const torrentService = require("../torrentService");
    if (messageContent.result === "success") {
        return torrentService.populateTorrentWithResponseData(messageContent.response, messageContent.torrentGuid);
    } else {
        //failure
        return torrentService.handleStartingTorrentError(messageContent.torrent, messageContent.error);
    }
}

// TODO: refactor with sendResponse function
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

    // Send a response message from the worker setting it as a response to startDownload
    let messageToSend = { type: messageTypes.RESPONSE,
        initiator: messageTypes.START_DOWNLOAD,
        content: content
    };

    return sqsService.sendMessage(messageToSend);
}

const sendRequestMessage = (messageType, messageContent) => {
    let messageToSend = { type: messageType,
        content: messageContent
    };
    return sqsService.sendMessage(messageToSend);
}

// On the worker
const handleRequest = (requestPromise, successResponseClosure, failureResponseClosure) => {
    return requestPromise.then(successResponseClosure).catch(failureResponseClosure);
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

const getResponseErrorClosure = (requestType) => {
    return (error) => {
        return sendResponse(requestType, {error}, "failure");
    };
}

const getResponseSuccessClosure = (requestType, successfulContentGenerator) => {
    return (result) => {
        return sendResponse(requestType, successfulContentGenerator(result), "success");
    };
}




module.exports = downloadOperationHandlers;