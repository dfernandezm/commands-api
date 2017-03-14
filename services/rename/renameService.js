/**
 * Created by david on 13/03/2017.
 */
const utilService = require('../utilService');
const debug = require("debug")("services:renameService");
const renameExecutor = require("./renameExecutor");
const renameService = {};

renameService.renameFromWorker = (torrents, mediacenterSettings) => {
    return new Promise((resolve, reject) => {
        let taskGuid = utilService.generateGuid();
        debug("Starting renamer from worker/organizer, GUID: ", taskGuid);

        let baseLibraryPath = mediacenterSettings.baseLibraryPath;
        let xbmcHostOrIp = mediacenterSettings.xbmcHostOrIp;
        let processingPath = mediacenterSettings.processingTempPath;

        debug("Settings: %o", mediacenterSettings);
        let inputPaths = generateInputPaths(torrents);

        // Rename script is as follows
        // ./filebot-rename.sh path1,path2,pathn /mediacenter /path/to/log localhost:8080
        let renameCommandParameters = {
            inputPaths: inputPaths,
            baseLibraryPath: baseLibraryPath,
            logLocation: processingPath,
            xbmcHostOrIp: xbmcHostOrIp
        };

        let renameProcess = renameExecutor.executeFilebotRenameScript(renameCommandParameters);

        if (renameProcess.exitCode && renameProcess.exitCode === -1) {
            // It is an error spawning
            return reject(renameProcess);
        }

        // Start monitoring
        renameExecutor.startMonitoringRenamer(renameProcess, true);

        return resolve(torrents.map(torrent => torrent.hash));
    });
}

const generateInputPaths = (torrents) => {
    return torrents.map(torrent => torrent.filePath);
}

module.exports = renameService;


