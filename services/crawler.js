$ = require('cheerio');
var Promise = require('bluebird');
var req = require('request');

var request = Promise.promisify(require("request"));
Promise.promisifyAll(request);

crawler = {}

crawler.test = function(page) {

  request('https://thenewbay.org/recent/' + page).then(function(response, html) {

    console.log("Page: ", page);

    if (response.statusCode == 200) {
      console.log('in the callback');
      var tableResult = $('#searchResult',response.body);

      $('.vertTh', tableResult).each(function (index, element) {
        var tableElement = $(element).parent();

        var title = $('.detName a',tableElement).text();
        var magnet = $('td > a', tableElement).eq(0).attr('href');
        var seeds = $('td', tableElement).eq(2).text()

        var torrent = {
          title: title,
          magnetLink: magnet,
          seeds: seeds
        }
        
        console.log('Title: ', title);
        console.log('Magnet: ', magnet);
        console.log('Seeds: ', seeds);

      });




      //console.log(response.body);
    }
  }).catch(function(error) {
    console.log('Error', error);
  });
}

module.exports = crawler;
