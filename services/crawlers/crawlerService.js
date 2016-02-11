var tpb = require('./tpb');

crawlerService = {};

crawlerService.recentTpb = function() {
  tpb.recentVideoTorrents();
}

module.exports = crawlerService;
