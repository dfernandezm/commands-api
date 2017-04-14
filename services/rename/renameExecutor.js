/**
 * Created by david on 13/03/2017.
 */
const spawn = require('child_process').spawn;

const debug = require("debug")("services/rename:renameExecutor");
const Promise = require("bluebird");

//TODO: does not seem to promifisy properly...
const fs = Promise.promisifyAll(require("fs"));
const path = require("path");
const renameExecutor = {};
const _ = require("lodash");

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
            args = [ commandParameters.renamedPaths.join(","),
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

const buildTorrentsMap = (torrents, error) => {
    let torrentsMap = {};
    torrents.map(torrent => {
        torrentsMap[torrent.hash] = error;
    });
    return torrentsMap;
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
            } // else Subtitles, do something?
        });

        filebotProcess.stderr.on('data', function (data) {
            lastError = data.toString();
            debug('[FILEBOT-COMMAND-ERROR]: ' + lastError);

        });

        filebotProcess.on('exit',  (exitCode) => {
            let exitCodeNum = parseInt(exitCode);
            debug("Filebot Process exited with code: %s",exitCodeNum);
            const tvsterMessageService = require("../sqs/tvsterMessageService");
            if (isRenamer) {
                debug("Completed Renames %o", completedRenames);

                if (_.isEmpty(completedRenames)) {
                    torrents.forEach((torrent) => {
                        completedRenames[torrent.hash] = [];
                    })
                }

                if (exitCodeNum !== 0) {
                    tvsterMessageService.renameCompleted({status: "failure", renamedTorrents: completedRenames});
                } else {
                    tvsterMessageService.renameCompleted({status: "success", renamedTorrents: completedRenames});
                }
                debug("======== Sent rename completed ========");
            } else {
                debug("Completed subtitles %o", torrentsToFetchSubs);
                if (exitCodeNum !== 0) {
                    let subtitlesResult = {};
                    torrentsToFetchSubs.forEach(torrent => {
                        subtitlesResult[torrent.hash] = {status: "failure", error: lastError};
                    });
                    tvsterMessageService.subtitlesCompleted(subtitlesResult);
                } else {
                    validateSubtitledTorrents(torrentsToFetchSubs).then(validationResults => {
                        debug("Validation results %s", JSON.stringify(validationResults));
                        tvsterMessageService.subtitlesCompleted({status: "success", subtitlesResult: validationResults});
                        debug("====== Sent subtitles completed ======");
                    }).catch(err => {
                        debug("Error occurred", err);
                        let torrentsMap = buildTorrentsMap(torrentsToFetchSubs, err);
                        tvsterMessageService.subtitlesCompleted({status: "failure", subtitlesResult: torrentsMap});
                    }) ;
                }
            }
        });
    });
}

const validateSubtitledTorrents = (torrents) => {
    let validationResults = {};
    return Promise.map(torrents, (torrent) => {
       return validateSingleTorrent(torrent).then((allPathsResults) => {
           validationResults[torrent.hash] = allPathsResults;
       });
    }).then(() => {
        debug("Finished validation %s", JSON.stringify(validationResults));
        return validationResults;
    });
}

const checkFilesInPath = (filesToCheck, singlePath) => {
    return Promise.all(filesToCheck).then((results) => {
        debug("Results to check for subtitles %s", JSON.stringify(results));
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
            debug("English subtitles found for %s", singlePath);
        }

        return {singlePath, subtitleForPath};
    });
}

const validateSinglePath = (singlePath) => {
    return Promise.resolve().then(() => {
        let baseDir = path.dirname(singlePath);
        let extension = path.extname(singlePath);
        let fileWithoutExtension = path.basename(singlePath, extension);
        debug("Checking subtitles for file: %s", fileWithoutExtension);

        let spaFile = baseDir + "/" + fileWithoutExtension + ".spa.srt";
        let esFile = baseDir + "/" + fileWithoutExtension + ".es.srt";
        let engFile = baseDir + "/" + fileWithoutExtension + ".eng.srt";
        let enFile = baseDir + "/" + fileWithoutExtension + ".en.srt";

        let filesToCheckPromises = [existsFile(spaFile),existsFile(esFile),existsFile(engFile),existsFile(enFile)];
        return checkFilesInPath(filesToCheckPromises, singlePath);
    });
}

const validateSingleTorrent = (torrent) => {
    let renamedPath = torrent.renamedPath;
    let renamedPaths = renamedPath.split(";");
    debug("Validating torrent with paths %s", JSON.stringify(renamedPaths));
    return Promise.map(renamedPaths, (renamedPath) => {
       return validateSinglePath(renamedPath);
    }).then(allPathsResults => {
        // Flatten
        debug("Subtitles paths for torrent %s => %s", torrent.hash, JSON.stringify(allPathsResults));
        return allPathsResults.reduce((acc, item) => {
            return acc.concat(item);
        }, []);
    });
}

const existsFile = (file) => {
    return fs.statAsync(file)
        .then(() => {return true})
        .catch(() => {return false});
};

module.exports = renameExecutor;
