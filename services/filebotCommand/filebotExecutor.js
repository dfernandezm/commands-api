var shellService = require('../shellService');
var fs = require('fs');
var log = require('../fb-logger');
var _ = require('lodash');
var FILEBOT_SCRIPTS_PATH = __dirname + "/scripts";
var spawn = require('child_process').spawn;
var torrentService = require('../torrentService');

var pathMovedPattern = /\[TEST\]\s+Rename\s+(.*)to\s+\[(.*)\]/;
var pathSkippedPattern = /Skipped\s+\[(.*)\]\s+because\s+\[(.*)\]/;
var hashRegex = /_([\w]{40})/;

var filebotExecutor = {};

var completedProcesses = {};

filebotExecutor.executeRenameTasks = function(renameTasks) {
  var symlinkDone = false;
  log.debug("[FILEBOT-EXECUTOR] About to execute rename tasks");
   _.forEach(renameTasks, function(renameTask) {
     log.debug("[FILEBOT-EXECUTOR] Executing rename command task for torrent: ", renameTasks.torrentHash);
     if (renameTask.customAmc && !symlinkDone) {
       log.debug("[FILEBOT-EXECUTOR] Symlinking custom AMC scripts...");
       symlinkCustomScripts(FILEBOT_SCRIPTS_PATH, renameTask.processingPath);
       symlinkDone = true;
     }
     var filebotCommand = renameTask.command;
     log.debug("[FILEBOT-EXECUTOR] Executing filebotCommand: ", filebotCommand);
     var filebotProcess = filebotExecutor.executeFilebotCommand(filebotCommand);

     if (filebotProcess !== null) {
        filebotExecutor.startMonitoringFilebotProcess(filebotProcess, renameTask.torrentHash);
     } else {
       log.error("Error occurred spawning Filebot process for command: ", filebotCommand);
     }
   });
}

filebotExecutor.executeFilebotCommand = function(filebotCommand) {
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
}

filebotExecutor.startMonitoringFilebotProcess = function(filebotProcess, torrentHash) {
 process.nextTick(function() {
   filebotProcess.stdout.on('data', function (data) {
       // log.info('[FILEBOT-COMMAND]: ' + data);
       var dataStr = data.toString();
       var match = pathMovedPattern.exec(dataStr);

       if (match !== null && match.length > 1) {
           var originalPath = match[1];
           var renamedPath = match[2];
           log.debug("[FILEBOT-COMMAND-RENAME-DETECTED] " + dataStr);
           log.debug("[FILEBOT-COMMAND-RENAME-DETECTED] " + originalPath + " --> " + renamedPath);

           completedProcesses[torrentHash] = {  type: 'RENAME', torrentHash: torrentHash,
                                                original: originalPath, renamedPath: renamedPath };

       } else {
           log.debug("[FILEBOT-COMMAND-RENAMING] " + dataStr);
       }
   });

   filebotProcess.stderr.on('data', function (data) {
     log.warn('[FILEBOT-COMMAND-ERROR]: ' + data);
   });

   filebotProcess.on('exit', function (exitCode) {
       log.info("Process exited with code: " + exitCode);
       if (exitCode == 0) {
           log.info("[FILEBOT-COMMAND-FINISHED] Successful renamed torrent hash: " + torrentHash);
           //TODO: DOES NOT WORK, completedRename is undefined!!
           var completedRename = completedProcesses[torrentHash];
           if (fs.accessSync(completedRename.renamedPath)) {
               torrentService.completeTorrentRename(completedRename);
           }
       } else {
           log.info("[FILEBOT-COMMAND-ERRORED] Exited with code: " + exitCode);
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


module.exports = filebotExecutor;
