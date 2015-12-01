require('shelljs/global');

module.exports = {

    checkExecutable: function(executablePath) {
      var message = "";
      if (!which(executablePath)) {
        message = 'Sorry, this script requires ' + executablePath;
        echo(message);
        return { error: message, status: "ERROR" };
      } else {
        message = "The executable " + executablePath + " exists";
        return { message: message, status: "CORRECT"};
      }
    },

    executeWithCallback: function(execLine) {
      var child = exec(execLine, {async: true});
      child.stdout.on('data', function(data) {
        echo("From inside --> " + data);
      });
    }

}
