//FILEBOT_AMC_CMD="$FB_EXEC -script $AMC_SCRIPT_PATH --output \"$OUTPUT\" --log-file $LOG_LOCATION --action $ACTION -non-strict \"$INPUT_PATH\" --def clean=y --conflict auto --def skipExtract=y --lang $CONTENT_LANG"
//FILEBOT_AMC_CMD="$FILEBOT_AMC_CMD --def unsorted=y --def \"seriesFormat=TV Shows/{n.upperInitial()}/{episode.special ? 'Specials':'Season '+s}/{n.upperInitial()} {episode.special ? '0xSpecial '+special.pad(2) : sxe.pad(2)} $TITLE_ESCAPED\" \"movieFormat=Movies/{n} ({y})/{n}\""
var _ = require('lodash');
var util = require('util');
var defaultOptions = require('./filebotOptions');
var filebotArgs = require('./filebotArguments');
var CommandType = require('../../util/FilebotCommandType');

// Constructor
function FilebotCommand(commandType, inputPath, options) {
  // This allows invoking the constructor without 'new' word
  if (!(this instanceof FilebotCommand)) {
    return new FilebotCommand(commandType, inputPath, options);
  }

  // always initialize all instance properties
  this.commandType = commandType || CommandType.RENAME;
  this.inputPath = inputPath;

  this.options = {};
  _.extend(this.options, defaultOptions);
  _.extend(this.options, options);

  this.commandArguments = [];
}

var proto = {};

proto.addArgument = function(argumentName, argumentValue) {
  if (!_.includes(this.commandArguments, argumentName)) {
    this.commandArguments.push({
        argumentName: argumentName,
        argumentValue: argumentValue
    });
  }
}

proto.setOptions = function(options) {
  this.options = defaultOptions;
  _.extend(this.options, options);
}

proto.input = function(inputPath) {
  this.inputPath = inputPath;
  //TODO: Case of custom script provided -- only one for now
  return this;
}

proto.output = function(outputPath) {
  this.options.output = outputPath;
  this.addArgument(filebotArgs.OUTPUT, outputPath);
  return this;
}

proto.customScript = function(scriptNameOrPath) {
  this.options.customScript = scriptNameOrPath;
  this.addArgument(filebotArgs.SCRIPT, scriptNameOrPath);
  return this;
}

proto.logTo = function(logLocation) {
  this.options.logFile = logLocation;
  this.addArgument(filebotArgs.LOGFILE, logLocation);
  return this;
}

proto.action = function(actionName) {
  this.options.action = actionName;
  this.addArgument(filebotArgs.ACTION, actionName);
  return this;
}

proto.amcOptions = function(amcOptions) {

  if (amcOptions.clean) {
    this.options.clean = amcOptions.clean;
    this.addArgument(filebotArgs.DEF_CLEAN,amcOptions.clean);
  }

  if (amcOptions.skipExtract) {
    this.options.skipExtract = amcOptions.skipExtract;
    this.addArgument(filebotArgs.DEF_SKIP_EXTRACT,amcOptions.skipExtract);
  }

  if (amcOptions.unsorted) {
    this.options.unsorted = amcOptions.unsorted;
    this.addArgument(filebotArgs.DEF_UNSORTED,amcOptions.unsorted);
  }

  return this;
}

proto.defaultAmcOptions = function() {
  this.customScript(this.options.amcScript);
  this.addArgument(filebotArgs.DEF_CLEAN, this.options.clean);
  this.addArgument(filebotArgs.DEF_SKIP_EXTRACT, this.options.skipExtract);
  this.addArgument(filebotArgs.DEF_UNSORTED, this.options.unsorted);
  return this;
}

proto.contentLanguage = function(lang) {
  this.options.contentLanguage = lang;
  this.addArgument(filebotArgs.LANG, lang);
  return this;
}

// class methods
proto.generate = function() {

  var command = "";
  var tvShowsAndMoviesPart = "";
  var customScriptPart = "";
  var defParts = "";

  var initPart = util.format("%s", this.options.executable);
  var outputPart = this._generateArgument(filebotArgs.OUTPUT);
  var logfilePart = this._generateArgument(filebotArgs.LOGFILE);
  var actionPart = this._generateArgument(filebotArgs.ACTION);
  var inputPart = this.options.strict + " \"" + this.inputPath + "\"";

  //TODO: different presets
  if (this.commandType == CommandType.RENAME) {
    customScriptPart = this._generateArgument(filebotArgs.SCRIPT) + " ";
    defParts = this._generateArgument(filebotArgs.DEF_CLEAN) + " " +
                   this._generateArgument(filebotArgs.DEF_SKIP_EXTRACT) + " " +
                   this._generateArgument(filebotArgs.DEF_UNSORTED) + " " +
                   this._generateArgument(filebotArgs.DEF_XMBC);

    var tvShowsFormat = this.options.tvShowsFormat.replace('$TV_SHOWS_FOLDER', this.options.tvShowsFolderName);
    var moviesFormat = this.options.moviesFormat.replace('$MOVIES_FOLDER', this.options.moviesFolderName);

    tvShowsAndMoviesPart = util.format("--def \"%s\" \"%s\"", tvShowsFormat, moviesFormat);

    command = initPart + " " + customScriptPart + " " + outputPart + " " +
              logfilePart + " " + actionPart + " " + inputPart + " " +
              defParts + " " + tvShowsAndMoviesPart;
  }

  console.log("Generated command: " + command);
  return command;
};

//TODO; this should be private
proto._generateArgument = function (argumentName) {
  var argument = _.find(this.commandArguments, {argumentName : argumentName});
  //console.log("generating: " + argumentName + " argument object " + argument);

  if(typeof argument !== "undefined") {
    //console.log(", cmdArg: " + argument.argumentName + ", val: " + argument.argumentValue);
    if (_.startsWith(argumentName,'DEF')) {
        return argument.argumentName + argument.argumentValue;
    } else {
      return argument.argumentName + " " + argument.argumentValue;
    }
  } else {
    return "";
  }
}

proto.printOptions = function () {
  _.each(this.options, function(value, key) {
    console.log(key + ": " + value);
  });
}

FilebotCommand.prototype = proto;

module.exports = FilebotCommand;
