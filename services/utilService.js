var log = require('./logger');
var uuid = require('node-uuid');

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
  var guid = uuid.v1().substring(0,9);
  log.debug("Generated GUID: " + guid);
  return guid;
}

module.exports = utilService;
