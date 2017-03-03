/**
 * Created by david on 02/03/2017.
 */
const AWS = require("aws-sdk");
const debug = require("debug")("services/sqs:sqsService");
const utils = require("../utilService");
AWS.config.update({accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, region: process.env.AWS_DEFAULT_REGION});

const config = require("../../config/config.json");
const sqs = new AWS.SQS();
const Consumer = require('sqs-consumer');
let messageConsumer;

const getListeningQueue = () => {
    if (utils.isWorker()) {
        // worker listens in downloadsQueue
        return config.dev.downloadsQueueUrl;
    } else {
        // API listens on responses queue
        return config.dev.responsesQueueUrl;
    }
}

const getSendingQueue = () => {
    if (utils.isWorker()) {
        // worker sends to responsesQueue
        return config.dev.responsesQueueUrl;
    } else {
        // API sends to downloadsQueue
        return config.dev.downloadsQueueUrl;
    }
}


const setupMessageConsumer = (messageHandler) => {
    let queueUrl = getListeningQueue();
    if (!messageConsumer) {
        messageConsumer = Consumer.create({
            queueUrl: queueUrl,
            handleMessage: (message, done) => {
                debug("Messages received: {}", message);
                let firstMessageBody = message.Body;
                debug("Message received: {}", firstMessageBody);
                messageHandler(firstMessageBody);
                done();
            }
        });
        messageConsumer.on('error', (err) => {
            debug("Error polling for messages", err.message);
        });

        messageConsumer.start();
    }
}

const stopMessageConsumer = () => {
    if (messageConsumer) {
        debug("Stopping messageConsumer");
        messageConsumer.stop();
    } else {
        debug("There is no messageConsumer setup, nothing to stop");
    }
}

const startMessageConsumer = () => {
    if (messageConsumer) {
        messageConsumer.start();
    } else {
        debug("There is no messageConsumer setup, setting it up now...");
    }
}

const sendMessage = (message) => {
    return new Promise((resolve, reject) => {

        sqs.sendMessage({QueueUrl: getSendingQueue(), MessageBody: JSON.stringify(message)}, (err, data) => {
            if (err) {
                debug("Error happened sending message {}", message);
                return reject(err);
            }
            debug("Message successfully sent {} - {}", message, data);
            return resolve(data);
        });
    });
}

module.exports = { sendMessage, startMessageConsumer, stopMessageConsumer, setupMessageConsumer };