"use strict";

var shellService = require('../shellService');
var fs = require('fs');
var log = require('../fb-logger');
var _ = require('lodash');
var FILEBOT_SCRIPTS_PATH = __dirname + "/scripts";
var spawn = require('child_process').spawn;
var torrentService = require('../torrentService');
var TorrentState = require('../torrentState');
const tvsterMessageService = require("../sqs/tvsterMessageService");
let debug =  require("debug")("services:filebotExecutor");

// Filebot response
var pathMovedPattern = /\[MOVE\]\s+Rename\s+(.*)to\s+\[(.*)\]/;
const subsNotFoundPattern = /^No\s+matching\s+subtitles\s+found:(.*)$/;

let filebotExecutor = {};

filebotExecutor.executeRenameTasks = (renameTasks) => {

    log.debug("[FILEBOT-EXECUTOR] Executing rename tasks", renameTasks);

    //let filebotProcessingPath = renameTasks[0].processingPath;
    //let symlinkDone = existCustomScriptsSymlinks(filebotProcessingPath);

    _.forEach(renameTasks, (renameTask) => {
        log.debug("[FILEBOT-EXECUTOR] Executing rename command task for torrent: ", renameTask.torrentHash);

        // === No symlinks now, common AMC script ===
        // if (renameTask.customAmc && !symlinkDone) {
        //     log.debug("[FILEBOT-EXECUTOR] Symlinking custom AMC scripts...");
        //     symlinkCustomScripts(FILEBOT_SCRIPTS_PATH, filebotProcessingPath);
        //     symlinkDone = true;
        // }
        executeFilebotCommand(renameTask.command, renameTask.torrentHash, true);
    });
};

// =========================================================================================================================

function executeFilebotCommand(filebotCommand, torrentHash, isRenamer) {
    log.debug("[FILEBOT-EXECUTOR] Executing Filebot command: ", filebotCommand);
    let filebotProcess = executeFilebotCommandInSpawnedProcess(filebotCommand);

    if (filebotProcess !== null) {
        startMonitoringFilebotProcess(filebotProcess, torrentHash, isRenamer);
    } else {
        log.error("Error occurred spawning Filebot process for command: ", filebotCommand);
    }
}

function executeFilebotCommandInSpawnedProcess(filebotCommand) {
    try {
        let executable = filebotCommand.executable();
        let args = filebotCommand.argumentsArray();
        log.debug("[FILEBOT-EXECUTOR] Executable is: [" + executable + "]");
        log.debug("[FILEBOT-EXECUTOR] Arguments are: [" + args.join(" ") + "]");
        return spawn(executable, args).on('error', (err) => {
            debug("Error spawning process", err);
            return null;
        });
    } catch (err) {
        log.error("Error occurred spawning Filebot process ", err);
        return null;
    }
}

function startMonitoringFilebotProcess(filebotProcess, torrentHash, isRenamer) {

    // Give the chance to run other tasks by deferring process listeners
    process.nextTick(() => {

        let completedRenames = {};
        completedRenames[torrentHash] = [];

        filebotProcess.stdout.on('data', function (data) {

            const dataStr = data.toString('utf8');
            log.debug("[FILEBOT-COMMAND] " + dataStr);

            if (isRenamer) {

                const match = pathMovedPattern.exec(dataStr);
                if (match !== null && match.length > 1) {
                    var originalPath = match[1];
                    var renamedPath = match[2];

                    log.debug(`[FILEBOT-RENAMER-DETECTED] ${originalPath}  ===>  ${renamedPath}`);

                    completedRenames[torrentHash].push({
                        type: 'RENAME',
                        original: originalPath,
                        renamedPath: renamedPath
                    });
                }
            } else {
                //TODO: if subtitles
            }
        });

        filebotProcess.stderr.on('data', function (data) {
            log.warn('[FILEBOT-COMMAND-ERROR]: ' + data);
        });

        filebotProcess.on('close',  (exitCode) => {

            log.info("Filebot Process exited with code: " + exitCode);

            if (isRenamer) {
                let renamedTorrentsWithStatus = processTorrentPostRename(exitCode, completedRenames, torrentHash);
                tvsterMessageService.renameCompleted(renamedTorrentsWithStatus);
                debug(" >>>>>>> Sent rename completed");
            } else {
                //TODO: is subtitles
            }

        });

    });
};

function processTorrentPostRename(renamerExitCode, completedRenames, torrentHash) {
    let renamedTorrentsWithStatus = {};

    if (!renamedTorrentsWithStatus[torrentHash]) {
        renamedTorrentsWithStatus[torrentHash] = [];
    }

    if (renamerExitCode == 0) {

        log.info(`[FILEBOT-RENAMER-FINISHED] Successful renamed torrent hash ${torrentHash}`);
        log.info("[FILEBOT-RENAMER-FINISHED] Completed renames: " + JSON.stringify(completedRenames));

        let completedRenamesForTorrent = completedRenames[torrentHash];
        let renamedError = false;

        _.forEach(completedRenamesForTorrent, (completedRename) => {
            try {
                fs.accessSync(completedRename.renamedPath);
                renamedTorrentsWithStatus[torrentHash].push({
                    renameData: completedRename,
                    status: "success"
                });
            } catch (err) {
                log.warn(`Renamed file does not exist: ${completedRename.renamedPath}, setting ${torrentHash} back to 
                          DOWNLOAD_COMPLETED`, err);
                // Put back to download completed
                renamedError = true;
                renamedTorrentsWithStatus[torrentHash].push({
                   error: `Renamed file does not exist: ${completedRename.renamedPath}`,
                   status: "error"
                });
            }
        });

        if (!renamedError) {
            log.info(`Renamer completed for torrent ${torrentHash} -- RENAMING_COMPLETED`);
            //return torrentService.completeTorrentRename(torrentHash, renamedPaths.join(';'));
        } else {
            log.warn(`Detected renamer error, setting torrent ${torrentHash} back to DOWNLOAD_COMPLETED`);
            //return torrentService.saveTorrentWithStateUsingHash(torrentHash, TorrentState.DOWNLOAD_COMPLETED);
        }

    } else {

        log.info(`[FILEBOT-RENAMER-ERRORED] Exited with code: ${renamerExitCode}`);
        // Put back to download completed
        renamedTorrentsWithStatus[torrentHash].push({
            error: `Renamer exited with code: ${renamerExitCode}`,
            status: "error"
        });

        //return torrentService.saveTorrentWithStateUsingHash(torrentHash, TorrentState.DOWNLOAD_COMPLETED);
    }
    return renamedTorrentsWithStatus;
}

function symlinkCustomScripts(filebotScriptsPath, processingTempPath) {
    log.debug("[FILEBOT-EXECUTOR] Symlinking custom Filebot scripts -- lib and AMC to temp path: ", FILEBOT_SCRIPTS_PATH);
    var amcScriptPath = processingTempPath + "/amc.groovy";
    var cleanerScriptPath = processingTempPath + "/cleaner.groovy";
    var libScriptsPath = processingTempPath + "/lib";

    // Ensure we delete them first, as they can be stale paths
    try {
      fs.unlinkSync(amcScriptPath);
      fs.unlinkSync(cleanerScriptPath);
      fs.unlinkSync(libScriptsPath);
    } catch(err) {
      log.debug("[FILEBOT-EXECUTOR] Error deleting symlinks -- this is because they did not exist previously: ", err);
    }
    
    // Create symlinks
    fs.symlinkSync(filebotScriptsPath + "/amc.groovy",  amcScriptPath);
    fs.symlinkSync(filebotScriptsPath + "/cleaner.groovy",  cleanerScriptPath);
    fs.symlinkSync(filebotScriptsPath + "/lib", libScriptsPath);

    return amcScriptPath;
}

function existCustomScriptsSymlinks(processingTempPath) {
    var amcScriptPath = processingTempPath + "/amc.groovy";
    var cleanerScriptPath = processingTempPath + "/cleaner.groovy";
    var libScriptsPath = processingTempPath + "/lib";
    let symlinksExist;

    try {
        fs.accessSync(amcScriptPath) && fs.accessSync(cleanerScriptPath) && fs.accessSync(libScriptsPath);
        symlinksExist = true;
    } catch (err) {
        // Assume this error is ENOENT, so they don't exist
        log.warn("[FILEBOT-EXECUTOR] Error accessing symlinks -- this is likely to be due to they are absent, which is ok ", err)
        symlinksExist = false;
    }

    return symlinksExist;
}

module.exports = filebotExecutor;
