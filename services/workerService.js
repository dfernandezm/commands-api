/**
 * Created by david on 02/03/2017.
 */
const debug = require("debug")("services:worker");
const transmissionService = require("./transmissionService");
const filebotService = require("./filebotService");

const workerService = {};

workerService.startDownload = (torrent) => {
    return transmissionService.startTorrent(torrent);
}


module.exports = workerService;