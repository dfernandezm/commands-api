var shellService = require('./shellService')
var CommandStatus = require('../util/CommandStatus');
var FilebotCommandType = require('../util/FilebotCommandType');

filebotService = {

    existsFilebot: function () {
        return shellService.checkExecutable('filebot').status == CommandStatus.OK;
    },

    getFilebotInfo: function () {
        if (this.existsFilebot()) {
           shellService.executeWithCallback('filebot -script fn:sysinfo');
           return { filebotCommand: FilebotCommandType.INFO, status: CommandStatus.RUNNING };
        } else {
           return { filebotCommand: FilebotCommandType.INFO, status: CommandStatus.EXECUTABLE_NOT_FOUND};
        }
    }
};

module.exports = filebotService;
