/**
 * Created by david on 18/03/2017.
 */
const sqsService = require("../sqsService");
const messageTypes = require("../messageTypes");

const messageHandlerHelper = {};

messageHandlerHelper.sendRequestMessage = (messageType, messageContent) => {
    let messageToSend = { type: messageType,
        content: messageContent
    };
    return sqsService.sendMessage(messageToSend);
}

messageHandlerHelper.sendResponse = (initiatorType, content, statusResult) => {
    content.result = statusResult;

    // Send a response message from the worker setting its initiator (the message type that generated this response)
    let messageToSend = {
        type: messageTypes.RESPONSE,
        initiator: initiatorType,
        content: content
    };

    return sqsService.sendMessage(messageToSend);
}

module.exports = messageHandlerHelper;