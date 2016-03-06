var log = require('./logger');
var hashRegex = /urn:btih:(.*)&dn=/;
var torrentNameMagnetRegex = /&dn=(.*?)&tr=/;
var torrentNameFileRegex = /\/([^\/]+).torrent$/;
var _ = require('lodash');

var torrentUtilsService = {};

torrentUtilsService.getHashFromMagnet = function(magnetLink) {
  var match = hashRegex.exec(magnetLink);
  if (match !== null && match.length > 1) {
    var hash = match[1];
    return hash;
  } else {
    console.log("Cannot return hash from magnet: ", magnetLink);
  }

  return null;
}

torrentUtilsService.getNameFromMagnetLinkOrTorrentFile = (magnetOrTorrentFileLink) => {
  if (_.startsWith(magnetOrTorrentFileLink, 'magnet:')) {
    var match = torrentNameMagnetRegex.exec(magnetOrTorrentFileLink);
    if (match !== null && match.length > 1) {
      var name = unescape(match[1]);
      return name;
    }
  } else {
    var match = torrentNameFileRegex.exec(magnetOrTorrentFileLink);
    if (match !== null && match.length > 1) {
      var name = unescape(match[1]);
      return name;
    }
  }
}

module.exports = torrentUtilsService;
