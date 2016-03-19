var shellService = require('../shellService');
var fs = require('fs');
var log = require('../fb-logger');
var _ = require('lodash');
var FILEBOT_SCRIPTS_PATH = __dirname + "/scripts";
var spawn = require('child_process').spawn;
//1. symlink custom scripts

var filebotExecutor = {};

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
        filebotExecutor.startMonitoringFilebotProcess(filebotProcess);
     } else {
       log.error("Error occurred spawning Filebot process for command: ", filebotCommand);
     }
   });
}

filebotExecutor.executeFilebotCommand = function(filebotCommand) {
  try {
    // var filebotCommandArray = _.trim(filebotCommand).split(' ');
    // var executable = _.head(filebotCommandArray);
    // var arguments = _.tail(filebotCommandArray);
    var executable = filebotCommand.executable();
    var arguments = filebotCommand.argumentsArray();
    arguments = _.pull(arguments, "");
    log.debug("[FILEBOT-EXECUTOR] Executing ", executable, " with arguments: ", arguments);
    var child = spawn(executable, arguments);
    return child;
  } catch (err) {
    log.error("Error occurred spawning Filebot process ", err);
  }
  return null;
}

filebotExecutor.startMonitoringFilebotProcess = function(filebotProcess) {
 process.nextTick(function() {
   log.debug("Setting process stream handlers");
   filebotProcess.stdout.on('data', function (data) {
     log.info('[FILEBOT-COMMAND] Output: ' + data);
   });

   filebotProcess.stderr.on('data', function (data) {
     log.warn('[FILEBOT-COMMAND] Err Output: ' + data);
   });

   filebotProcess.on('exit', function (exitCode) {
     log.info("Process exited with code: " + exitCode);
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
      log.debug("[FILEBOT-EXECUTOR] Error deleting symlinks -- this is because they did no exist previously: ",err);
    }
    
    // Create symlinks
    fs.symlinkSync(filebotScriptsPath + "/amc.groovy",  amcScriptPath);
    fs.symlinkSync(filebotScriptsPath + "/cleaner.groovy",  cleanerScriptPath);
    fs.symlinkSync(filebotScriptsPath + "/lib", libScriptsPath);

    return amcScriptPath;
}


module.exports = filebotExecutor;
