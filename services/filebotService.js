var shellService = require('./shellService')
var CommandStatus = require('../util/CommandStatus');
var FilebotCommandType = require('../util/FilebotCommandType');
var filebot = require('./filebotCommand/FilebotCommand');

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
                .logTo("/tmp/logs/filebot.log")
                .defaultAmcOptions();

  var outputCommand = filebotCommand.generate();
  console.log("The command is: \n" + outputCommand);
}

module.exports = filebotService;
