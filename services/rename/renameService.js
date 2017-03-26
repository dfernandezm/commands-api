/**
 * Created by david on 13/03/2017.
 */
const utilService = require('../utilService');
const debug = require("debug")("services:renameService");
const renameExecutor = require("./renameExecutor");
const path = require("path");
const _ = require("lodash");
const UNSORTED_PATH = "Unsorted";
const renameService = {};

renameService.renameOrSubtitlesFromWorker = (torrents, mediacenterSettings, isRenamer) => {
    return new Promise((resolve, reject) => {
        let taskGuid = utilService.generateGuid();
        debug("Starting renamer from worker/organizer, GUID: ", taskGuid);

        let baseLibraryPath = mediacenterSettings.baseLibraryPath;
        let xbmcHostOrIp = mediacenterSettings.xbmcHostOrIp;
        let processingPath = mediacenterSettings.processingTempPath;
        debug("Settings: %o", mediacenterSettings);

        let runningProcess;

        if (isRenamer) {
            let inputPaths = generateInputPaths(torrents);
            inputPaths.push(baseLibraryPath + "/" + UNSORTED_PATH);

            // Rename script is as follows
            // ./filebot-rename.sh path1,path2,pathn /mediacenter /path/to/log localhost:8080
            let renameCommandParameters = {
                inputPaths: inputPaths,
                baseLibraryPath: baseLibraryPath,
                logLocation: processingPath,
                xbmcHostOrIp: xbmcHostOrIp
            };

            runningProcess = renameExecutor.executeFilebotScript(renameCommandParameters,true);
        } else {
            // Subtitles script as follows
            // ./filebot-subs.sh path1,path2,pathn /path/to/log
            let renamedPaths = getPathsToFetchSubtitlesIn(torrents);
            let subtitleFetchingParams = {
                torrents: torrents,
                renamedPaths: renamedPaths,
                logLocation: processingPath
            }

            runningProcess = renameExecutor.executeFilebotScript(subtitleFetchingParams,false);
        }

        if (runningProcess.exitCode && runningProcess.exitCode === -1) {
            // It is an error spawning
            return reject(runningProcess);
        }

        // Start monitoring
        renameExecutor.startMonitoringProcess(runningProcess, torrents, isRenamer);

        return resolve(torrents.map(torrent => torrent.hash));
    });
}

const generateInputPaths = (torrents) => {
    return torrents.map(torrent => torrent.filePath);
}

const getPathsToFetchSubtitlesIn = (torrents) => {
    // Get folders to fetch subs in
    let allPaths = torrents.map(torrent => {
       return torrent.renamedPath.split(";").map(singleRenamedPath => {
           return path.dirname(singleRenamedPath);
       });
    });

    // Flatten to single array of paths
    allPaths = _.flattenDeep(allPaths);

    // Return the unique paths (as multiple file torrents will probably be in the same folder)
    return _.uniqBy(allPaths);
}

module.exports = renameService;


