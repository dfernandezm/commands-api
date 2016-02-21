var Promise = require('bluebird');
var request = Promise.promisify(require("request"));
Promise.promisifyAll(request);

crawlerUtils = {}

// Request url and use the closure to attempt torrent data extraction from it
crawlerUtils.attemptDataExtractionFromUrl = function(url, retrieveDataClosure) {
  return request(url).then(function(response) {

    console.log("Connecting to URL: ", url);
    if (response.statusCode == 200) {
      return retrieveDataClosure(response.body);
    }
  }).catch(function(error) {
    console.log('Error connecting to url ' + url, error);
    return error;
  });
}

module.exports = crawlerUtils;
