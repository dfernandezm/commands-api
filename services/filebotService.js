var shellService = require('./shellService');
var CommandStatus = require('../util/CommandStatus');
var FilebotCommandType = require('../util/FilebotCommandType');
var filebot = require('./filebotCommand/FilebotCommand');
var log = require('./logger');
var settingsService = require('./settingsService');
var _ = require('lodash');
var Promise = require('bluebird');
var utilService = require('./utilService');
var jobService = require('./jobService');
var TorrentState = require('./torrentState');
var torrentService = require('./torrentService');
var filebotExecutor = require('./filebotCommand/filebotExecutor');
let debug =  require("debug")("services:filebotService");

var AMC_SCRIPT_NAME = 'amc.groovy';

var filebotService = {};

filebotService.renameTorrent = function (torrentHash) {
    return torrentService.findByHash(torrentHash).then(function (torrent) {
        return filebotService.rename([torrent]);
    });
};

filebotService.renameChecking = () => {
    log.debug("[RENAMER] Running renameChecking... ");
    return torrentService.findTorrentsWithState(TorrentState.RENAMING)
                         .then(startRenamerIfNotRunning);
};

// In torrentService!
var startRenamerIfNotRunning = (renamingTorrents) => {

    if (renamingTorrents == null || renamingTorrents.length == 0) {

        log.info("[RENAMER] Checking if there are torrents to rename...");

        // Find torrents in DOWNLOAD_COMPLETED state
        return torrentService.findTorrentsWithState(TorrentState.DOWNLOAD_COMPLETED).then((torrents) => {
            if (torrents !== null && torrents.length > 0) {
                return filebotService.rename(torrents);
            } else {
                log.info("[RENAMER] There is no torrents to rename");
                return null;
            }
        });
    } else {
        log.warn("There is already one rename in progress");
    }
};


filebotService.existsFilebot = function () {
    return shellService.checkExecutable('filebot').status == CommandStatus.OK;
};

filebotService.getFilebotInfo = function () {
    if (this.existsFilebot()) {
        return {filebotCommand: FilebotCommandType.INFO, status: CommandStatus.RUNNING};
    } else {
        return {filebotCommand: FilebotCommandType.INFO, status: CommandStatus.EXECUTABLE_NOT_FOUND};
    }
};

filebotService.createRenameCommand = function (renameCommandSpec) {
    var filebotCommand = filebot()
        .output(renameCommandSpec.outputPath)
        .customScript(renameCommandSpec.customScript)
        .action(renameCommandSpec.action)
        .input(renameCommandSpec.inputPath)
        .contentLanguage(renameCommandSpec.language)
        .logTo(renameCommandSpec.logFile)
        .defaultAmcOptions();

    var outputCommand = filebotCommand.generate();
    log.debug("[FILEBOT-RENAME] The command is: ", outputCommand);
    return filebotCommand;
}

/**
 * Execute a renaming operation given the following parameters
 *
 */
// with DB
filebotService.prepareRename = function (torrentList) {

    var mSettings = settingsService.getDefaultMediacenterSettings();
    var tSettings = settingsService.getDefaultTransmissionSettings();
    var p = [mSettings, tSettings];
    return Promise.all(p).then(function (result) {

        var mediacenterSettings = result[0];
        var baseLibraryPath = mediacenterSettings.baseLibraryPath;
        var xbmcHostOrIp = mediacenterSettings.xbmcHostOrIp;
        var processingPath = mediacenterSettings.processingTempPath;
        var amcScriptPath = processingPath + "/" + AMC_SCRIPT_NAME;
        var jobGuid = utilService.generateGuid();

        var renameTasks = [];
        var updatingPromises = [];

        _.forEach(torrentList, function (torrent) {

            if (torrent.state !== TorrentState.DOWNLOAD_COMPLETED) {
                log.warn('Torrent ', torrent.hash, ' is not in DOWNLOAD_COMPLETED, skipping...');
            } else {

                var logFile = processingPath + '/rename_' + jobGuid +
                    "_" + torrent.hash + ".log";
                log.debug("The log file is: ", logFile);

                var filePath = torrent.filePath;
                var contentLanguage = findLanguageFromTorrent(torrent);

                var filebotRenameSpec = {
                    outputPath: baseLibraryPath,
                    inputPath: filePath,
                    language: contentLanguage,
                    action: 'move',
                    xbmcHost: xbmcHostOrIp,
                    customScript: amcScriptPath,
                    logFile: logFile
                };

                var cmd = filebotService.createRenameCommand(filebotRenameSpec);
                var renameTask = {
                    command: cmd,
                    torrentHash: torrent.hash,
                    customAmc: true,
                    processingPath: processingPath
                };

                log.debug("[FILEBOT-RENAME] Rename task command arguments: ", renameTask.command.argumentsArray());
                log.debug("[FILEBOT-RENAME] Rename task customAmc: ", renameTask.customAmc);
                log.debug("[FILEBOT-RENAME] Rename task hash: ", renameTask.torrentHash);
                log.debug("[FILEBOT-RENAME] Rename task processingPath: ", renameTask.processingPath);
                updatingPromises.push(setTorrentAsRenaming(torrent.hash));
                renameTasks.push(renameTask);
            }
        });

        //TODO: Add extra task for elements inside Unsorted folder

        if (renameTasks.length > 0) {
            return Promise.all(updatingPromises).then(() => {
                return filebotService.startRenamerJob(renameTasks, jobGuid);
            });
        } else {
            log.warn("No torrents selected to rename -- it is likely renamer already started");
            return {message: "No torrents selected to rename", state: "NOT_CREATED"};
        }
    }).catch(function (err) {
        log.error("Error getting settings ", JSON.stringify(err));
        //TODO: more verbose
        console.log("error ", err);
        throw err;
    });
};

//Deprecated -- for DB access, but even with that is not needed
filebotService.startRenamerJob = function (renameTasks, jobGuid) {
    log.debug("Creating job with GUID: ", jobGuid);
    return jobService.createJob({guid: jobGuid, state: 'PROCESSING', jobType: 'RENAME'})
        .then(function (job) {
            log.info("Renamer job started with GUID: ", jobGuid);
            process.nextTick(function () {
                log.debug(" ====== FILEBOT EXECUTOR ===== ");
                log.debug("Rename specs ---> :", renameTasks);
                filebotExecutor.executeRenameTasks(renameTasks);
            });
            return job;
        });
}

filebotService.rename = function (torrentList) {
    return filebotService.prepareRename(torrentList).then(function (job) {
        log.debug("Renamer started: ", job);
        return job;
    }).catch(function (error) {
        log.error("Error occurred starting renamer: ", error);
        throw error;
    });
};

// ======= Worker/Organizer ======

filebotService.renameFromWorker = (torrents, mediacenterSettings) => {
    return new Promise((resolve, reject) => {
        let taskGuid = utilService.generateGuid();
        debug("Starting renamer from worker/organizer, GUID: ", taskGuid);
        let baseLibraryPath = mediacenterSettings.baseLibraryPath;
        let xbmcHostOrIp = mediacenterSettings.xbmcHostOrIp;
        let processingPath = mediacenterSettings.processingTempPath;
        let amcScriptPath = "fn:amc";

        let renameTasks = [];
        let renamingTorrentsHashes = [];

        _.forEach(torrents, function (torrent) {
            if (torrent.state !== TorrentState.DOWNLOAD_COMPLETED) {
                log.warn('Torrent ', torrent.hash, ' is not in DOWNLOAD_COMPLETED, skipping...');
            } else {

                let logFile = processingPath + '/rename_' + taskGuid +
                    "_" + torrent.hash + ".log";
                log.debug("The log file is: ", logFile);

                let filePath = torrent.filePath;
                let contentLanguage = findLanguageFromTorrent(torrent);

                let filebotRenameSpec = {
                    outputPath: baseLibraryPath,
                    inputPath: filePath,
                    language: contentLanguage,
                    action: 'move',
                    xbmcHost: xbmcHostOrIp,
                    customScript: amcScriptPath,
                    logFile: logFile
                };

                let cmd = filebotService.createRenameCommand(filebotRenameSpec);
                let renameTask = {
                    command: cmd,
                    torrentHash: torrent.hash,
                    customAmc: false,
                    processingPath: processingPath
                };

                log.debug("[FILEBOT-RENAME] Rename task command arguments: ", renameTask.command.argumentsArray());
                log.debug("[FILEBOT-RENAME] Rename task customAmc: ", renameTask.customAmc);
                log.debug("[FILEBOT-RENAME] Rename task hash: ", renameTask.torrentHash);
                log.debug("[FILEBOT-RENAME] Rename task processingPath: ", renameTask.processingPath);
                renamingTorrentsHashes.push(torrent.hash);
                renameTasks.push(renameTask);
            }
        });
        //TODO: Add extra task for elements inside Unsorted folder
        if (renameTasks.length > 0) {
            process.nextTick(function () {
                log.debug(" ====== FILEBOT EXECUTOR ===== ");
                log.debug("Rename specs ---> :", renameTasks);
                filebotExecutor.executeRenameTasks(renameTasks);
            });
            return resolve(renamingTorrentsHashes);
        } else {
            log.warn("No torrents selected to rename -- it is likely renamer already started");
            return reject({message: "No torrents selected to rename", state: "NOT_CREATED"});
        }
    });
}

// ===========================================================

function setTorrentAsRenaming(torrentHash) {
    return torrentService.findByHash(torrentHash).then(function (torrent) {
        torrent.state = TorrentState.RENAMING;
        return torrent.save();
    });
}

function findLanguageFromTorrent(torrent) {
    var canonicalString = torrent.torrentFileLink || torrent.torrentName;
    var spanishIndicators = require('../config/languageConfig.json').spanishIndicators;
    var normalizedString = _.trim(_.toLower(canonicalString));

    _.forEach(spanishIndicators, function (indicator) {
        if (normalizedString.indexOf(indicator)) {
            return "es";
        }
    });

    return "en";
}


module.exports = filebotService;
