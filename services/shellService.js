require('shelljs/global');
var StatusMessage = require('../util/StatusMessage');
var CommandStatus = require('../util/CommandStatus');

shellService = {
    checkExecutable: function(executablePath) {
      var statusMessage = new StatusMessage();
      if (!which(executablePath)) {
        statusMessage.message = 'Sorry, this script requires ' + executablePath;
        statusMessage.status = CommandStatus.ERROR;
      } else {
        statusMessage.message = "The executable " + executablePath + " exists";
      }
      return statusMessage;
    },

    executeWithCallback: function(execLine) {
      var child = exec(execLine, {async:true, silent:true});
      child.stdout.on('data', function(data) {
        echo(data);
      });
      return child;
    },

    execute: function(execLine) {
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
};

module.exports = shellService;
