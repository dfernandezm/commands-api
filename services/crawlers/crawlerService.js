var tpb = require('./tpb');
var preDb = require('./preDb');

crawlerService = {};

crawlerService.recentVideoTorrents = function(page) {
  return tpb.recentVideoTorrents(page);
}

crawlerService.preDb = function() {
  return preDb.getReleases();
}

module.exports = crawlerService;
