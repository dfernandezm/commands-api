var log = require('./logger');
var settingsService = require('./settingsService');
var MAX_TRIES = 5;
const _ = require("lodash");
var Powersteer = require('powersteer');
var transmissionClient = new Powersteer({
    url: 'http://:9091/transmission/rpc',
    username: '',
    password: ''
});

var transmissionService = {};
const videoExtensions = [ "mkv", "mp4", "avi" ];

transmissionService.testConnection = function () {

  log.info("Testing connection to transmission...");
  return transmissionClient.sessionGet().then(function(result) {
    log.info("Connection to transmission successful", result);
    return result;
  }).catch(function(error) {
    log.error("Error connecting to transmission...", error);
  });
}

transmissionService.startTorrent = function(torrent) {
  var torrentLink = torrent.magnetLink ? torrent.magnetLink : torrent.torrentFileLink;
  log.debug("About to start downloading torrent with link: ", torrentLink);
  return retry(MAX_TRIES, transmissionClient.torrentAdd({filename: torrentLink})).then(function(result) {

     log.debug("Result: " + JSON.stringify(result));

     var resultJson = JSON.stringify(result);
     var resultNoHyphen = resultJson.replace('torrent-added','torrentAdded');
     resultNoHyphen = resultNoHyphen.replace('torrent-duplicate','torrentDuplicate');
     var resultObject = JSON.parse(resultNoHyphen);

     if (resultObject.result === "success" && resultObject.arguments.torrentDuplicate) {

       log.warn("[TORRENT-START] Duplicate torrent detected: ", torrent);
       throw {name: "DUPLICATED_TORRENT", message: 'Duplicate torrent detected', status: 400};
     } else if (resultObject.result === "success" && resultObject.arguments.torrentAdded) {

       var torrentResponse = resultObject.arguments.torrentAdded;
       var torrentName = torrentResponse.name;
       var torrentHash = torrentResponse.hashString;
       log.info("[TORRENT-START] Successfully started torrent: ",torrentHash);
       return transmissionService.relocateAndRestart(torrentName, torrentHash).then(function(newPath) {
         log.debug("Returning torrent response: ", torrentResponse);
         return { torrentResponse: torrentResponse, filePath: newPath};
       });
     } else {
       var msg = "Unexpected response from transmission start call ";
       log.error(msg, resultObject);
       throw {name: "START_FAILED", message: msg, status: 500};
     }
  });
}

transmissionService.status = function() {
  log.debug("Getting status from Transmission");
  var request = { fields:['id', 'name', 'totalSize', 'percentDone', 'hashString',
                           'torrentFile', 'magnetLink', 'rateDownload',
                           'webseedsSendingToUs', 'files', 'startDate'] };
  return retry(MAX_TRIES, transmissionClient.torrentGet(request)).then(returnResult);
}

transmissionService.setTorrentLocation = function(torrentHash, newPath) {
  return transmissionClient.torrentSetLocation({ids: [torrentHash],
                                        location: newPath,
                                        move: true})
                    .then(function(result) {
                      log.info("Successfully relocated torrent " + torrentHash);
                      return result;
                    });

}

transmissionService.relocateAndRestart = function(torrentName, torrentHash) {

  log.info("Relocating torrent... " + torrentName);

  //TODO: pass in the downloading path
  var newPath = getDownloadingTorrentsSubfolderPath("/mediacenter/torrents", torrentName, torrentHash);
  var restartTorrent = transmissionService.startTorrentNow(torrentHash);
    return transmissionService.setTorrentLocation(torrentHash, newPath).then(function(stl) {
      return restartTorrent.then(function(rt) {
        log.debug("Torrent restarted!");
        return newPath;
      });
    }).catch(transmissionService.returnErrorAndCancelTorrent(torrentHash));
}

/**
Forces torrent to start downloading. The torrent already exists in Transmission
*/
transmissionService.startTorrentNow = function(torrentHash) {
  return retry(MAX_TRIES,
               transmissionClient.torrentStartNow({ids: [torrentHash]})
                                 .then(returnResult));
}

//TODO: rename to deleteTorrent
transmissionService.cancelTorrent = function(torrentHash) {
    return retry(MAX_TRIES, transmissionClient.torrentRemove({ids: [torrentHash],
                                                             'delete-local-data': true}))
                                              .then(returnResult);
}

/**
* Here we craft the callback we want for the .catch part of a promise. Promises
* callbacks can only handle one parameter. This 'factory' function allows us to
* pass in any parameter (torrentHash in this case) and make it avaiable in the
* context of the caller (thanks to closures)
*/
transmissionService.returnErrorAndCancelTorrent = function(torrentHash) {
  return function(error) {
    log.error("There was an error relocating -- cancelling torrent");
    return transmissionService.cancelTorrent(torrentHash).then(function(r) {
      return {error: "Error relocating torrent " + torrentHash + ": " + error};
    });
  };
}

transmissionService.pauseTorrent = function(torrentHash) {
  log.debug("Pausing torrent in transmission: ", torrentHash);
  return retry(MAX_TRIES, transmissionClient.torrentStop({ids: [torrentHash]}));
}

transmissionService.resumeTorrent = function(torrentHash) {
  log.debug("Resuming torrent ", torrentHash);
  return retry(MAX_TRIES, transmissionClient.torrentStart({ids: [torrentHash]}));
}

// --- PRIVATE ----------------------------------------------------------------

function retry(maxRetries, promise) {
  return promise.catch(function(err) {
    if (maxRetries <= 0) {
      log.error("Error in request to transmission after 5 tries -- giving up: ", err);
      throw err;
    }
    log.warn("Error in request to Transmission -- retrying: ", err);
    return retry(maxRetries - 1, promise);
  });
}

function returnResult(result) {
  log.debug("Getting result from Transmission: ", result);
  return result;
}

const getDownloadingTorrentsSubfolderPath = (baseDownloadsDir, torrentName, torrentHash) => {

    try {

        let filtered = videoExtensions.filter((ext) => {
            return _.endsWith(torrentName.toLowerCase(), ext.toLowerCase());
        });

        if (filtered.length > 0) {
            log.warn("Torrent %s ends with video extension, this could create Filebot issues, stripping out from new path",torrentName);
            torrentName = torrentName.replace("." + filtered[0], "");
        }

        let newPath = baseDownloadsDir + "/" + torrentName + "_" + torrentHash;

        log.info("New Path to relocate is %s",newPath);
        return newPath;
    } catch(err) {
        log.error("Error calculating new path", err);
        throw err;
    }

}

module.exports = transmissionService;
