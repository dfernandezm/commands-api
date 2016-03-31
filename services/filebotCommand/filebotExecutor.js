var shellService = require('../shellService');
var fs = require('fs');
var log = require('../fb-logger');
var _ = require('lodash');
var FILEBOT_SCRIPTS_PATH = __dirname + "/scripts";
var spawn = require('child_process').spawn;
var torrentService = require('../torrentService');
var TorrentState = require('../torrentState');

// Filebot response
var pathMovedPattern = /\[MOVE\]\s+Rename\s+(.*)to\s+\[(.*)\]/;
var pathSkippedPattern = /Skipped\s+\[(.*)\]\s+because\s+\[(.*)\]/;
var hashRegex = /_([\w]{40})/;

var filebotExecutor = {};

filebotExecutor.executeRenameTasks = function (renameTasks) {

    log.debug("[FILEBOT-EXECUTOR] Executing rename tasks", renameTasks);
    var filebotProcessingPath = renameTasks[0].processingPath;
    var symlinkDone = existCustomScriptsSymlinks(filebotProcessingPath);

    _.forEach(renameTasks, function (renameTask) {
        log.debug("[FILEBOT-EXECUTOR] Executing rename command task for torrent: ", renameTasks.torrentHash);

        if (renameTask.customAmc && !symlinkDone) {
            log.debug("[FILEBOT-EXECUTOR] Symlinking custom AMC scripts...");
            symlinkCustomScripts(FILEBOT_SCRIPTS_PATH, filebotProcessingPath);
            symlinkDone = true;
        }

        var filebotCommand = renameTask.command;
        log.debug("[FILEBOT-EXECUTOR] Executing Filebot command: ", filebotCommand);
        var filebotProcess = filebotExecutor.executeFilebotCommand(filebotCommand);

        if (filebotProcess !== null) {
            filebotExecutor.startMonitoringFilebotProcess(filebotProcess, renameTask.torrentHash);
        } else {
            log.error("Error occurred spawning Filebot process for command: ", filebotCommand);
        }
    });
};

filebotExecutor.executeFilebotCommand = function (filebotCommand) {
    try {
        var executable = filebotCommand.executable();
        var arguments = filebotCommand.argumentsArray();
        arguments = _.pull(arguments, "");
        log.debug("[FILEBOT-EXECUTOR] Executing ", executable, " with arguments: ", arguments);
        return spawn(executable, arguments);
    } catch (err) {
        log.error("Error occurred spawning Filebot process ", err);
        return null;
    }
};

filebotExecutor.startMonitoringFilebotProcess = function (filebotProcess, torrentHash) {

    // Give the chance to run other tasks by deferring process listeners
    process.nextTick(function () {

        var completedRenames = {};
        completedRenames[torrentHash] = [];

        filebotProcess.stdout.on('data', function (data) {

            var dataStr = data.toString('utf8');

            log.debug("[FB] " + dataStr);

            var match = pathMovedPattern.exec(dataStr);
            if (match !== null && match.length > 1) {
                var originalPath = match[1];
                var renamedPath = match[2];

                log.debug(`[FILEBOT-COMMAND-RENAME-DETECTED] ${originalPath}  ===>  ${renamedPath}`);

                completedRenames[torrentHash].push({
                    type: 'RENAME',
                    torrentHash: torrentHash,
                    original: originalPath,
                    renamedPath: renamedPath
                });

            } else {
                log.debug("[FILEBOT-COMMAND-RENAMING] " + dataStr);
            }
        });

        filebotProcess.stderr.on('data', function (data) {
            log.warn('[FILEBOT-COMMAND-ERROR]: ' + data);
        });

        filebotProcess.on('close', function (exitCode) {

            log.info("Filebot Process exited with code: " + exitCode);

            if (exitCode == 0) {
                log.info(`[FILEBOT-FINISHED] Successful renamed torrent hash ${torrentHash}`);
                log.info("[FILEBOT-FINISHED] Completed renames: " + JSON.stringify(completedRenames));

                var completedRenamesForTorrent = completedRenames[torrentHash];
                var renamedPaths = [];
                var renamedError = false;

                _.forEach(completedRenamesForTorrent, (completedRename) => {

                    try {
                        fs.accessSync(completedRename.renamedPath);
                        renamedPaths.push(completedRename.renamedPath);
                    } catch (err) {
                        log.warn("Renamed file does not exist: " + completedRename.renamedPath +
                            ", mark to set torrent with hash ${torrentHash} back to DOWNLOAD_COMPLETED", err);
                        // Put back to download completed
                        renamedError = true;
                    }
                });

                if (!renamedError) {
                    log.info(`Complete renaming for torrent ${torrentHash} -- RENAMING_COMPLETED`);
                    return torrentService.completeTorrentRename(torrentHash, renamedPaths.join(';'));
                } else {
                    log.warn(`Setting torrent ${torrentHash} back to DOWNLOAD_COMPLETED`);
                    return torrentService.saveTorrentWithStateUsingHash(torrentHash, TorrentState.DOWNLOAD_COMPLETED);
                }

            } else {

                log.info("[FILEBOT-COMMAND-ERRORED] Exited with code: " + exitCode);

                // Put back to download completed
                return torrentService.saveTorrentWithStateUsingHash(torrentHash, TorrentState.DOWNLOAD_COMPLETED);
            }
        });
    });
}

// =========================================================================================================================

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
      log.debug("[FILEBOT-EXECUTOR] Error deleting symlinks -- this is because they did no exist previously: ", err);
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

    return fs.accessSync(amcScriptPath) && fs.accessSync(cleanerScriptPath) && fs.accessSync(libScriptsPath);
}



module.exports = filebotExecutor;
