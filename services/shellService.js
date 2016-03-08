require('shelljs/global');
var StatusMessage = require('../util/StatusMessage');
var CommandStatus = require('../util/CommandStatus');
var log = require('./logger');

shellService = {}

shellService.checkExecutable = function(executablePath) {
    var statusMessage = new StatusMessage();
    if (!which(executablePath)) {
      statusMessage.message = 'This script requires ' + executablePath;
      statusMessage.status = CommandStatus.ERROR;
    } else {
      statusMessage.message = "The executable " + executablePath + " exists";
    }
    return statusMessage;
}

shellService.executeWithCallback = function(execLine, callback) {
  var child = exec(execLine, {async:true, silent:true}/*, callback(code, output)*/);
  child.stdout.on('data', function(data) {
      echo(data);
  });
  return child;
}

shellService.execute = function(execLine) {
  log.debug('Executing command: ', execLine);
  var p = exec(execLine);
  var statusMessage = new StatusMessage();
  statusMessage.message = p.output;
  if (p.code != 0) {
      statusMessage.status = CommandStatus.ERROR;
  } else {
      statusMessage.status = CommandStatus.OK;
  }
    return statusMessage;
  }


module.exports = shellService;
