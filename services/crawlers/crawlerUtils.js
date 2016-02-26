var Promise = require('bluebird');
var request = Promise.promisify(require("request"));
Promise.promisifyAll(request);
var moment = require('moment');

crawlerUtils = {}
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1'}

// Request url and use the closure to attempt torrent data extraction from it
crawlerUtils.attemptDataExtractionFromUrl = function(url, retrieveDataClosure) {

  return Promise.delay(2000).then(function()  {

      console.log("After 2s --> " + moment().format('HH:mm:ss')) ;

      return request({uri: url, headers: headers}).then(function(response) {

          console.log("Connecting to URL: " + url + " -- " + moment().format('HH:mm:ss'));
          if (response.statusCode == 200) {
            return retrieveDataClosure(response.body);
          } else {
            console.log("Not 200 -- ", response.statusCode);
          }

        }).catch(function(error) {
          console.log('Error connecting to url ' + url, error);
          return error;
        });
  });

}

module.exports = crawlerUtils;
