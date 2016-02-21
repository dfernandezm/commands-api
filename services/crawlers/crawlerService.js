var tpb = require('./tpb');

crawlerService = {};

crawlerService.recentVideoTorrents = function(page) {
  return tpb.recentVideoTorrents(page);
}

module.exports = crawlerService;
