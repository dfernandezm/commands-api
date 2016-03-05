var log = require('./logger');
var hashRegex = /urn:btih:(.*)&dn=/;

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

module.exports = torrentUtilsService;
