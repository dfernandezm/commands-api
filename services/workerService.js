/**
 * Created by david on 02/03/2017.
 */
const debug = require("debug")("services:worker");
const transmissionService = require("./transmissionService");
const workerService = {};

workerService.startDownload = (torrent) => {
    return transmissionService.startTorrent(torrent);
}

workerService.pauseDownload = (torrentHash) => {
    return transmissionService.pauseTorrent(torrentHash);
}

workerService.resumeDownload = (torrentHash) => {
    return transmissionService.resumeTorrent(torrentHash);
}

workerService.getStatus = () => {
    return transmissionService.status().then((data) => {
        return data.arguments.torrents;
    });
}

workerService.startRename = (torrents, mediacenterSettings) => {
    const filebotService = require("./filebotService");
    debug("MediacenterSettings", mediacenterSettings);
    return filebotService.renameFromWorker(torrents, mediacenterSettings).catch((err) => {
        debug("Error is ", err);
        throw err;
    });
}

module.exports = workerService;