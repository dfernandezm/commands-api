/**
 * Created by david on 13/03/2017.
 */
const spawn = require('child_process').spawn;

const debug = require("debug")("services/rename:renameExecutor");
const Promise = require("bluebird");
const fs = Promise.promisifyAll(require("fs"));
const path = require("path");
const renameExecutor = {};

const pathMovedPattern = /\[MOVE\]\s+Rename\s+\[(.*)\]\s+to\s+\[(.*)\]/;
const hashRegex = /_([\w]{40})/;

renameExecutor.executeFilebotScript = (commandParameters, isRenamer) => {

    try {

        let args;
        let executablePath;

        if (isRenamer) {
            args = [ commandParameters.inputPaths.join(","),
                commandParameters.baseLibraryPath,
                commandParameters.logLocation,
                commandParameters.xbmcHostOrIp
            ];
            executablePath = __dirname + "/filebot-rename.sh";
        } else { // Is subtitles
            args = [ commandParameters.renamedPaths,
                commandParameters.logLocation
            ];
            executablePath = __dirname + "/filebot-subtitles.sh";
        }

        debug("Executable is", executablePath);
        debug("Arguments for script are %o", args);

        return spawn(executablePath, args).on('error', (err) => {
            debug("Error spawning script", err);
            return {exitCode: -1, error: err};
        });
    } catch (err) {
        debug("Error spawning script", err);
        return {exitCode: -1, error: err};
    }
}

renameExecutor.startMonitoringProcess = (filebotProcess, torrents, isRenamer) => {
    // Give the chance to run other tasks by deferring process listeners
    process.nextTick(() => {

        let completedRenames = {};
        let torrentsToFetchSubs;
        if (!isRenamer) {
            torrentsToFetchSubs = torrents;
        }
        let lastError;

        filebotProcess.stdout.on('data', function (data) {
            const dataStr = data.toString('utf8');
            debug("[FILEBOT-COMMAND] " + dataStr);

            if (isRenamer) {
                const match = pathMovedPattern.exec(dataStr);
                if (match !== null && match.length > 1) {
                    let originalPath = match[1];
                    let renamedPath = match[2];

                    debug(`[FILEBOT-RENAMER-DETECTED] ${originalPath}  ==>  ${renamedPath}`);

                    const matchHash = hashRegex.exec(originalPath);
                    debug("Match hash %o", matchHash);

                    if (matchHash !== null && matchHash.length > 1) {
                        debug("Torrent hash match is %s", matchHash);
                        let torrentHash = matchHash[1];

                        if (!completedRenames[torrentHash]) {
                            completedRenames[torrentHash] = [];
                        }

                        completedRenames[torrentHash].push({
                            type: 'RENAME',
                            original: originalPath,
                            renamedPath: renamedPath,
                            torrentHash: torrentHash
                        });

                    } else {
                        debug("Torrent hash was not found in original path %s -- skipping", originalPath);
                    }
                }
            } else {
                // Subtitles, do something?
            }
        });

        filebotProcess.stderr.on('data', function (data) {
            lastError = data;
            debug('[FILEBOT-COMMAND-ERROR]: ' + lastError);

        });

        filebotProcess.on('close',  (exitCode) => {
            debug("Filebot Process exited with code: %s",exitCode);
            const tvsterMessageService = require("../sqs/tvsterMessageService");
            if (isRenamer) {
                debug("Completed Renames %o", completedRenames);
                if (exitCode !== 0) {
                    tvsterMessageService.renameCompleted({status: "failure", renamedTorrents: completedRenames});
                } else {
                    tvsterMessageService.renameCompleted({status: "success", renamedTorrents: completedRenames});
                }
                debug("========Sent rename completed========");
            } else {
                debug("Completed subtitles %o", completedRenames);
                if (exitCode !== 0) {
                    tvsterMessageService.subtitlesCompleted({status: "failure", error: lastError});
                } else {
                    let validationResults = validateSubtitledTorrents(torrentsToFetchSubs);
                    tvsterMessageService.subtitlesCompleted({status: "success", subtitlesResult: validationResults});
                }
                debug("========Sent subtitles completed========");
            }
        });
    });
}

const validateTorrentsWithSubtitles = (torrents) => {
    let validationResults = {};
    torrents.forEach((torrent) => {
        let renamedPath = torrent.renamedPath;
        let renamedPaths = renamedPath.split(";");
        let promises = [];
        renamedPaths.forEach((singlePath, index, array) => {
            let baseDir = path.dirname(singlePath);
            let extension = path.extname(singlePath);
            let fileWithoutExtension = path.basename(renamedPath, extension);
            debug("Checking subtitles for file:%s", fileWithoutExtension);

            let spaFile = baseDir + "/" + fileWithoutExtension + ".spa.srt";
            let esFile = baseDir + "/" + fileWithoutExtension + ".es.srt";
            let engFile = baseDir + "/" + fileWithoutExtension + ".eng.srt";
            let enFile = baseDir + "/" + fileWithoutExtension + ".en.srt";

            promises.push(Promise.all(fs.exists(spaFile),fs.exists(esFile),fs.exists(engFile),fs.exists(enFile), (results) => {
                let spaFileExists = results[0];
                let esFileExists = results[1];
                let engFileExists = results[2];
                let enFileExists = results[3];
                let subtitleForPath = true;

                if (!spaFileExists && !esFileExists) {
                    debug("Missing Spanish subtitles for %s", singlePath);
                    subtitleForPath = false;
                } else {
                    debug("Spanish subtitles found for %s", singlePath);
                }

                if (!engFileExists && !enFileExists) {
                    debug("Missing English subtitles for %s", singlePath);
                    subtitleForPath = false;
                } else {
                    debug("Spanish subtitles found for %s", singlePath);
                }

                return {singlePath, subtitleForPath};
            }));

            return Promise.all(promises).then(results => {
                validationResults[torrent.hash] = results;
            });
        });
    });
    return validationResults;
}

const validateSubtitledTorrents = (torrents) => {
    let validationResults = {};
    return Promise.map(torrents, (torrent) => {
       return validateSingleTorrent(torrent).then((allPathsResults) => {
           validationResults[torrent.hash] = allPathsResults;
       });
    }).then(() => {
        debug("Finished validation %o", validationResults);
        return validationResults;
    });
}

const validateSingleTorrent = (validationResults, torrent) => {
    let renamedPath = torrent.renamedPath;
    let renamedPaths = renamedPath.split(";");
    return Promise.map(renamedPaths, (renamedPath) => {
       return validateSinglePath(renamedPath);
    }).then(allPathsResults => {
        return allPathsResults;
    });
}

const validateSinglePath = (singlePath) => {
    let baseDir = path.dirname(singlePath);
    let extension = path.extname(singlePath);
    let fileWithoutExtension = path.basename(renamedPath, extension);
    debug("Checking subtitles for file:%s", fileWithoutExtension);

    let spaFile = baseDir + "/" + fileWithoutExtension + ".spa.srt";
    let esFile = baseDir + "/" + fileWithoutExtension + ".es.srt";
    let engFile = baseDir + "/" + fileWithoutExtension + ".eng.srt";
    let enFile = baseDir + "/" + fileWithoutExtension + ".en.srt";
    let filesToCheck = [fs.exists(spaFile),fs.exists(esFile),fs.exists(engFile),fs.exists(enFile)];

    return Promise.all(filesToCheck, (results) => {
        let spaFileExists = results[0];
        let esFileExists = results[1];
        let engFileExists = results[2];
        let enFileExists = results[3];
        let subtitleForPath = true;

        if (!spaFileExists && !esFileExists) {
            debug("Missing Spanish subtitles for %s", singlePath);
            subtitleForPath = false;
        } else {
            debug("Spanish subtitles found for %s", singlePath);
        }

        if (!engFileExists && !enFileExists) {
            debug("Missing English subtitles for %s", singlePath);
            subtitleForPath = false;
        } else {
            debug("Spanish subtitles found for %s", singlePath);
        }

        return {singlePath, subtitleForPath};
    });
}


module.exports = renameExecutor;