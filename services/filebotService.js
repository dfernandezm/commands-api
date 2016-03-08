var shellService = require('./shellService')
var CommandStatus = require('../util/CommandStatus');
var FilebotCommandType = require('../util/FilebotCommandType');
var filebot = require('./filebotCommand/FilebotCommand');
var log = require('./logger');
var settingsService = require('./settingsService');
var _ = require('lodash');
var Promise = require('bluebird');
var utilService = require('./utilService');
var jobService = require('./jobService');

var AMC_SCRIPT_NAME = 'amc.groovy';

filebotService = {}

filebotService.existsFilebot = function () {
    return shellService.checkExecutable('filebot').status == CommandStatus.OK;
}

filebotService.getFilebotInfo = function () {
  if (this.existsFilebot()) {
    //shellService.executeWithCallback('filebot -script fn:sysinfo');
    return { filebotCommand: FilebotCommandType.INFO, status: CommandStatus.RUNNING };
  } else {
    return { filebotCommand: FilebotCommandType.INFO, status: CommandStatus.EXECUTABLE_NOT_FOUND};
  }
}

filebotService.testCommand = function() {
  var filebotCommand = filebot();
  filebotCommand.output("/tmp/test")
                .action("move")
                .input("/tmp/input")
                .contentLanguage("es")
                .logTo("/tmp/filebot.log")
                .defaultAmcOptions();

  var outputCommand = filebotCommand.generate();
  console.log("The command is: \n" + outputCommand);
}

filebotService.createRenameCommand = function(renameCommandSpec) {
  var filebotCommand = filebot();
  filebotCommand.output(renameCommandSpec.outputPath)
                .customScript(renameCommandSpec.customScript)
                .action("move")
                .input(renameCommandSpec.inputPath)
                .contentLanguage(renameCommandSpec.language)
                .logTo(renameCommandSpec.logFile)
                .defaultAmcOptions();

  var outputCommand = filebotCommand.generate();
  log.debug("[FILEBOT-RENAME] The command is: ", outputCommand);
}

/**
* Execute a renaming operation given the following parameters
*
*/
filebotService.prepareRename = function(torrentList) {

  var mSettings = settingsService.getDefaultMediacenterSettings();
  var tSettings = settingsService.getDefaultTransmissionSettings();
  var p = [mSettings, tSettings];
  return Promise.all(p).then(function (result) {
           log.debug("Got settings from DB");
           var mediacenterSettings = result[0];
           var transmissionSettings = result[1];

           var baseLibraryPath = mediacenterSettings.baseLibraryPath;
           log.debug("Base library path ", baseLibraryPath);
           var xbmcHostOrIp = mediacenterSettings.xbmcHostOrIp;
           var processingPath = mediacenterSettings.processingTempPath;
           var amcScriptPath = processingPath + "/" + AMC_SCRIPT_NAME;
           var jobGuid = utilService.generateGuid();

           var renameTasks = [];
           _.forEach(torrentList, function(torrent) {
               log.debug("Torrent ",  torrent);
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
               }

               var renameTask = {
                 command: filebotService.createRenameCommand(filebotRenameSpec),
                 torrentHash: torrent.hash
               }

               renameTasks.push(renameTask);
           });

           return filebotService.startRenamer(renameTasks, jobGuid);
         }).catch(function(err) {
           log.error("Error getting settings ", JSON.stringify(err));
           //tODO: more verbose
           console.log("error ", err);
           throw err;
         });
}

filebotService.startRenamer = function(renameTasks, jobGuid) {
  log.info("Received call to rename");
  log.debug("Creating job with GUID: ", jobGuid);
  //TODO: check every torrent in correct state (DOWNLOAD_COMPLETED) and mark them as RENAMING 
  return jobService.createJob({guid: jobGuid, state: 'PROCESSING', jobType: 'RENAME'})
            .then(function(job) {
               log.info("Renamer job started with GUID: ", jobGuid);
               process.nextTick(function () {
                 log.debug(" ====== FILEBOT EXECUTOR ===== ");
                 log.debug("Rename specs: ", renameTasks);
               });
               return job;
  });
}

filebotService.rename = function(torrentList) {
  return filebotService.prepareRename(torrentList).then(function(job) {
     log.debug("Renamer started! ", job);
     return job;
  }).catch(function (error) {
    log.error("Error occurred starting renamer: ", error);
    throw error;
  })
}

// ===========================================================

function findLanguageFromTorrent(torrent) {
  var canonicalString = torrent.torrentFileLink || torrent.torrentName;
  var spanishIndicators = require('../config/languageConfig.json').spanishIndicators;
  var normalizedString = _.trim(_.toLower(canonicalString));

  _.forEach(spanishIndicators, function(indicator) {
    if (normalizedString.indexOf(indicator)) {
      return "es";
    }
  });

  return "en";
}



module.exports = filebotService;
