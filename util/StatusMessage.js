var CommandStatus = require("./CommandStatus");
// Private shared variables (across instances)
// var total = 0;

// Constructor
function StatusMessage(message, status) {
  // always initialize all instance properties
  this.message = message;
  this.status = status || CommandStatus.OK;
}

// class methods
StatusMessage.prototype.print = function() {
    return this.status + " -- " + this.message;
};
// export the class
module.exports = StatusMessage;
