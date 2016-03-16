var log = require('./logger');
var uuid = require('node-uuid');
var _ = require('lodash');
var Promise = require('bluebird');
Promise.onPossiblyUnhandledRejection(function(error){
    throw error;
});

var globalIntervals = {};
var utilService = {};

utilService.startNewInterval = function(intervalName, fn, rate) {
  var interval = globalIntervals[intervalName];
  if (typeof interval == 'undefined' || interval == null) {
      log.info('log level ' + log.getLevel());
      log.debug("Starting interval process for ", intervalName);
      globalIntervals[intervalName] = setInterval(fn, rate);
      log.debug('The interval ID for [' + intervalName + "] has been set");
  } else {
    log.debug("There is already an interval running with this name: " + intervalName);
  }
}

utilService.stopInterval = function(intervalName) {
  log.debug("Stopping interval: " + intervalName);
  if (typeof globalIntervals[intervalName] !== 'undefined' && globalIntervals[intervalName] !== null) {
    clearInterval(globalIntervals[intervalName]);
    globalIntervals[intervalName] = null;
    log.debug("Interval [" + intervalName + "] stopped.");
  } else {
    log.debug("Interval [" + intervalName + "] already stopped or not running");
  }
}

utilService.generateGuid = function() {
  var guid = uuid.v1().substring(0,8);
  log.debug("Generated GUID: " + guid);
  return guid;
}

utilService.handleApiError = function(res) {
  return function(error) {
    log.debug("===> Called API error handler: ", error.message);
    res.status(error.status || 500);
    res.json({ status: error.status || 500, error: error.message});
  }
}

utilService.generateErrorResponse = function(res, errorCode, statusCode, message) {
  res.status(statusCode);
  res.json({resultCode: errorCode, errorMessage: message});
}

utilService.clearSpecialChars = function(torrentName) {
  torrentName = torrentName.replace("ñ","n");
  torrentName = torrentName.replace("Ñ","N");
  torrentName = torrentName.replace("á","a");
  torrentName = torrentName.replace("é","e");
  torrentName = torrentName.replace("í","i");
  torrentName = torrentName.replace("ó","o");
  torrentName = torrentName.replace("ú","u");
  torrentName = torrentName.replace("Á","A");
  torrentName = torrentName.replace("É","E");
  torrentName = torrentName.replace("Í","I");
  torrentName = torrentName.replace("Ó","O");
  torrentName = torrentName.replace("Ú","U");
  torrentName = torrentName.replace(" ",".");
  torrentName = torrentName.replace("+",".");
  torrentName = torrentName.replace("?",".");
  log.debug("Cleared name is ", torrentName);
  return torrentName;
}

utilService.isEmptyObject = function(object) {
  return Object.keys(obj).length === 0 && JSON.stringify(obj) === JSON.stringify({});
}

utilService.jsonSerializer = function(key, value) {
  if (value === null) {
    return undefined;
  }
  return value;
}

module.exports = utilService;
