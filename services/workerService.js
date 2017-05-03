/**
 * Created by david on 02/03/2017.
 */
const log = require('./logger');
const transmissionService = require("./transmissionService");
const renameService = require("./rename/renameService");
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

workerService.cancelDownload = (torrentHash) => {
    return transmissionService.cancelTorrent(torrentHash);
}

workerService.getStatus = () => {
    return transmissionService.status().then((data) => {
        return data.arguments.torrents;
    });
}

workerService.startRename = (torrents, mediacenterSettings) => {
    log.debug("MediacenterSettings", mediacenterSettings);
    return renameService.renameOrSubtitlesFromWorker(torrents, mediacenterSettings, true).catch((err) => {
        log.error("Error is ", err);
        throw err;
    });
}

workerService.startSubtitles = (torrents, mediacenterSettings) => {
    log.debug("MediacenterSettings", mediacenterSettings);
    return renameService.renameOrSubtitlesFromWorker(torrents, mediacenterSettings, false).catch((err) => {
        log.debug("Error is ", err);
        throw err;
    });
}

module.exports = workerService;