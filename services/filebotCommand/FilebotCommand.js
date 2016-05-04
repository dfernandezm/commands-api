"use strict";

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
    this.command = "";

    this.options = {};
    _.extend(this.options, defaultOptions);
    _.extend(this.options, options);

    this.commandArguments = [];
}

var proto = {};

proto.addArgument = function (argumentName, argumentValue) {
    if (!_.includes(this.commandArguments, argumentName)) {
        this.commandArguments.push({
            argumentName: argumentName,
            argumentValue: argumentValue
        });
    }
}

proto.setOptions = function (options) {
    this.options = defaultOptions;
    _.extend(this.options, options);
}

proto.input = function (inputPath) {
    this.inputPath = inputPath;
    //TODO: Case of custom script provided -- only one for now
    return this;
}

proto.output = function (outputPath) {
    this.options.output = outputPath;
    this.addArgument(filebotArgs.OUTPUT, outputPath);
    return this;
}

proto.customScript = function (scriptNameOrPath) {
    this.options.customScript = scriptNameOrPath;
    this.addArgument(filebotArgs.SCRIPT, scriptNameOrPath);
    return this;
}

proto.logTo = function (logLocation) {
    this.options.logFile = logLocation;
    this.addArgument(filebotArgs.LOGFILE, logLocation);
    return this;
}

proto.action = function (actionName) {
    this.options.action = actionName;
    this.addArgument(filebotArgs.ACTION, actionName);
    return this;
}

proto.amcOptions = function (amcOptions) {

    if (amcOptions.clean) {
        this.options.clean = amcOptions.clean;
        this.addArgument(filebotArgs.DEF_CLEAN, amcOptions.clean);
    }

    if (amcOptions.skipExtract) {
        this.options.skipExtract = amcOptions.skipExtract;
        this.addArgument(filebotArgs.DEF_SKIP_EXTRACT, amcOptions.skipExtract);
    }

    if (amcOptions.unsorted) {
        this.options.unsorted = amcOptions.unsorted;
        this.addArgument(filebotArgs.DEF_UNSORTED, amcOptions.unsorted);
    }

    return this;
};

proto.defaultAmcOptions = function () {
    this.addArgument(filebotArgs.DEF_CLEAN, this.options.clean);
    this.addArgument(filebotArgs.DEF_SKIP_EXTRACT, this.options.skipExtract);
    this.addArgument(filebotArgs.DEF_UNSORTED, this.options.unsorted);
    this.addArgument(filebotArgs.DEF_XBMC, this.options.xbmcHostOrIp);
    return this;
};

proto.contentLanguage = function (lang) {
    this.options.contentLanguage = lang;
    this.addArgument(filebotArgs.LANG, lang);
    return this;
};

proto.defaultTvShowsMoviesPattern = function () {
    var tvShowsFormat = this.options.tvShowsFormat.replace('$TV_SHOWS_FOLDER', this.options.tvShowsFolderName);
    var moviesFormat = this.options.moviesFormat.replace('$MOVIES_FOLDER', this.options.moviesFolderName);
    var tvShowsAndMoviesPattern = util.format("\"%s\" \"%s\"", tvShowsFormat, moviesFormat);
    this.addArgument(filebotArgs.DEF, tvShowsAndMoviesPattern);
};

proto.argumentsArray = function () {
    var outputPart = this._generateArgumentPair(filebotArgs.OUTPUT);
    var logfilePart = this._generateArgumentPair(filebotArgs.LOGFILE);
    var actionPart = this._generateArgumentPair(filebotArgs.ACTION);
    var inputPart = [this.options.strict, this.inputPath];
    var langPart = this._generateArgumentPair(filebotArgs.LANG);
    var args = [];

    if (this.commandType == CommandType.RENAME) {
        let customScriptPart = this._generateArgumentPair(filebotArgs.SCRIPT);
        let defParts = _.concat(this._generateArgumentPair(filebotArgs.DEF_CLEAN),
            this._generateArgumentPair(filebotArgs.DEF_SKIP_EXTRACT),
            this._generateArgumentPair(filebotArgs.DEF_UNSORTED),
            this._generateArgumentPair(filebotArgs.DEF_XBMC));

        var tvShowsFormat = this.options.tvShowsFormat.replace('$TV_SHOWS_FOLDER', this.options.tvShowsFolderName);
        var moviesFormat = this.options.moviesFormat.replace('$MOVIES_FOLDER', this.options.moviesFolderName);

        let tvShowsAndMoviesPart = [filebotArgs.DEF, tvShowsFormat, moviesFormat];

        args = _.concat(customScriptPart, outputPart,
            logfilePart, actionPart, inputPart,
            langPart, defParts, tvShowsAndMoviesPart);
    }
    if (this.commandType === CommandType.SUBTITLES) {
        let missingSubtitles = this._generateArgumentPair(filebotArgs.SUBTITLES);
        let encodingPart = this._generateArgumentPair(filebotArgs.ENCODING);
        args = _.concat(missingSubtitles, inputPart, langPart, outputPart, encodingPart, logfilePart);
    }

    return args;
};

proto.executable = function () {
    return this.options.executable;
};

// class methods
proto.generate = function () {

    var command = "";
    var tvShowsAndMoviesPart = "";
    var customScriptPart = "";
    var defParts = "";

    var initPart = util.format("%s", this.options.executable);
    var outputPart = this._generateArgument(filebotArgs.OUTPUT);
    var logfilePart = this._generateArgument(filebotArgs.LOGFILE);
    var actionPart = this._generateArgument(filebotArgs.ACTION);
    var inputPart = this.options.strict + " \"" + this.inputPath + "\"";
    var langPart = this._generateArgument(filebotArgs.LANG);

    if (this.commandType == CommandType.RENAME) {
        customScriptPart = this._generateArgument(filebotArgs.SCRIPT) + " ";
        defParts = this._generateArgument(filebotArgs.DEF_CLEAN) + " " +
            this._generateArgument(filebotArgs.DEF_SKIP_EXTRACT) + " " +
            this._generateArgument(filebotArgs.DEF_UNSORTED) + " " +
            this._generateArgument(filebotArgs.DEF_XMBC);
        defParts = defParts.replace("  ", " ");

        var tvShowsFormat = this.options.tvShowsFormat.replace('$TV_SHOWS_FOLDER', this.options.tvShowsFolderName);
        var moviesFormat = this.options.moviesFormat.replace('$MOVIES_FOLDER', this.options.moviesFolderName);

        tvShowsAndMoviesPart = util.format("--def \"%s\" \"%s\"", tvShowsFormat, moviesFormat);

        command = initPart + " " + customScriptPart + " " + outputPart + " " +
            logfilePart + " " + actionPart + " " + inputPart + " " +
            langPart + " " + defParts + " " + tvShowsAndMoviesPart;
    }

    if (this.commandType === CommandType.SUBTITLES) {
        let missingSubtitles = this._generateArgument(filebotArgs.SUBTITLES);
        let encodingPart = this._generateArgument(filebotArgs.ENCODING);
        command = [initPart, missingSubtitles, inputPart, langPart, outputPart, encodingPart, logfilePart].join(" ");
    }

    console.log("Generated command: " + command);
    this.command = command;
    return command;
};

proto._generateArgument = function (argumentName) {
    var argument = _.find(this.commandArguments, {argumentName: argumentName});

    if (typeof argument !== "undefined") {
        if (_.startsWith(argumentName, filebotArgs.DEF)) {
            return argument.argumentName + argument.argumentValue;
        } else {
            return argument.argumentName + " " + argument.argumentValue;
        }
    } else {
        return "";
    }
};

proto._generateArgumentPair = function (argumentName) {
    var argument = _.find(this.commandArguments, {argumentName: argumentName});
    if (typeof argument !== "undefined") {
        if (_.startsWith(argumentName, filebotArgs.DEF)) {
            argumentName = argumentName.replace(filebotArgs.DEF, "");
            return [filebotArgs.DEF, argumentName + argument.argumentValue];
        } else {
            return [argument.argumentName, argument.argumentValue];
        }
    } else {
        return [];
    }
};

proto.printOptions = function () {
    _.each(this.options, function (value, key) {
        console.log(key + ": " + value);
    });
};

proto.commandOut = () => {
    return this.command;
};

proto.missingSubtitles = () => {
    this.commandType = CommandType.SUBTITLES;
    this.addArgument(filebotArgs.SUBTITLES, "");
    return this;
};

proto.encoding = (encoding) => {
    this.options.encoding = encoding;
    this.addArgument(filebotArgs.ENCODING, encoding);
    return this;
};

FilebotCommand.prototype = proto;

module.exports = FilebotCommand;
