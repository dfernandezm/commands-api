var log = require('./logger');
var settingsService = require('./settingsService');
var MAX_TRIES = 5;

var Powersteer = require('powersteer');
var transmissionClient = new Powersteer({
    url: 'http://:9091/transmission/rpc',
    username: '',
    password: ''
});

var transmissionService = {};
var globalIntervals = {};

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

  var torrentLink = torrent.magnetLink ? torrent.magnetLink : torrent.fileLink;
  log.info("Torrent to add " + torrent);
  return retry(MAX_TRIES, transmissionClient.torrentAdd({filename: torrentLink})).then(function(result) {

     log.info("Result: " + JSON.stringify(result));

     //TODO: Check for 'torrent-duplicate'
     var resultJson = JSON.stringify(result);
     var resultNoHyphen = resultJson.replace('torrent-added','torrentAdded');
     var resultObject = JSON.parse(resultNoHyphen);

     var torrentName = resultObject.arguments.torrentAdded.name;
     var torrentHash = resultObject.arguments.torrentAdded.hashString;
     log.info("Successfully started torrent: " + torrentHash);

     return transmissionService.relocateAndRestart(torrentName, torrentHash);
  });
}

transmissionService.status = function() {

  log.info("Getting status from Transmission");
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

  var torrentSubfolderPath = getTorrentSubfolderPath(torrentName, torrentHash);
  var restartTorrent = transmissionService.startTorrentNow(torrentHash);

  return torrentSubfolderPath.then(function(newPath) {
    return transmissionService.setTorrentLocation(torrentHash, newPath).then(function(stl) {
      return restartTorrent.then(function(rt) {
        log.info("Torrent restarted!");
        return newPath;
      });
    })
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

// --- PRIVATE ----------------------------------------------------------------

function retry(maxRetries, promise) {
  return promise.catch(function(err) {
    if (maxRetries <= 0) {
      log.error("Error in request to transmission after 5 tries -- giving up: ", err);
      throw err;
    }
    log.error("Error in request to Transmission -- retrying: ", err);
    return retry(maxRetries - 1, fn);
  });
}

function returnResult(result) {
  log.info("Getting result from Transmission: ", result);
  return result;
}

function getTorrentSubfolderPath(torrentName, torrentHash) {
  return settingsService.getDefaultTransmissionSettings()
                        .then(composeRelocatePath(torrentName, torrentHash));
}

/**
* This function returns the function that 'then' wants, but also adds some extra
* information via closure binding.
*/
function composeRelocatePath(torrentName, torrentHash) {
  return function (transmissionSettings) {
    var newPath = transmissionSettings.baseDownloadsDir + "/" +
                  torrentName + "_" + torrentHash;
    log.info("New Path to relocate is: " + newPath);
    return newPath;
  }
}

module.exports = transmissionService;
