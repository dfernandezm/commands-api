$ = require('cheerio');
var crawlerUtils = require('./crawlerUtils');
var format = require('string-format');
var moment = require('moment');
var _ = require('lodash');
var Promise = require("bluebird");

var baseUrl = "http://predb.me/?cats=tv,movies&page={}";

preDb = {}

function parse(html) {
  var loadedHtml = $(html);
  return parseReleases(loadedHtml);
}

function parseSingleReleaseData(html) {
  console.log("---Release Extra Data--");
  var filters = ['group', 'tags', 'size', 'nukes'];
  var releaseData = {};
  var context = $(html);
  $('.post-body-table .pb-r', context).each(function(index, element)  {

    var key = $(element).children().first().text().toLowerCase();
    var val = $(element).children().last().text();

    if (val === '···') val = '';

    switch (key) {
      case 'tags':
        releaseData[key] = val && val.split(', ');
        break;
      case 'size':
        releaseData[key] = val.split(' ')[0]
        releaseData.files = val.split(' ')[3];
        break;
      default:
        if (filters.indexOf(key) >= 0) {
          releaseData[key] = val;
        }
    }
  });
  return releaseData;
}

function parseReleases(context) {
  var info = {};
  info.releases = [];

  $('.post', context).each(function(index, element) {
    var release = {};

    if (index === 0) {
      info.lastId = $(element, context).attr('id');
    }

    release.id = $(element, context).attr('id');
    release.rlsname = $(element, context).find('.p-title').text()

    release.extraDataUrl = "http://predb.me/?post=" + release.id;

    var releasedUnix = $(element, context).find('.p-time').attr('data');
    release.releasedDateLocal = $(element, context).find('.p-time').attr('title');

    var unix = parseInt(releasedUnix);
    release.releasedDate = moment.unix(unix).format('DD-MM-YYYY HH:mm');
    release.category = {
      main: $(element, context).find('.p-cat .c-adult').text(),
      sub: $(element, context).find('.p-cat .c-child').text(),
    };
    release.nukes = $(element, context).find('.tb-nuked').attr('title') || '';
    release.nukes = release.nukes && release.nukes.substring(7);

    info.releases.push(release);
  });

  // Add extra info for full page scrapes
  if (!$('.jsload', context).length) {
    info.currentPage = $('.page-list .page-current').text();
    info.numPages = $('.page-list .last-page').text().substring(0, 3);
    info.numReleases = $('.s-blurb .release-count').attr('data');
  }

  return preDb.processExtraInfo(info);
}

preDb.processExtraInfo = function(info) {

  var toProcess = [];
  for (i = 0; i < info.releases.length; i++) {
      toProcess.push(info.releases[i]);
  }

  console.log("Array of urls: ", toProcess);

  // One at a time, delaying 2s
  return Promise.map(toProcess, function(release) {

      console.log("Executing...");
      return preDb.promiseWorker(release);

  }, {concurrency: 3}).then(function(data) {
      console.log("Promise chain finished: ", data);
      return data;
    });
}

preDb.promiseWorker = function(release) {
    return crawlerUtils.attemptDataExtractionFromUrl(release.extraDataUrl, parseSingleReleaseData).then(function(extraData) {
        release.extraData = extraData;
        return release;
    });
}

preDb.getReleases = function() {
  console.log("=== Getting releases from PreDB ===")
  var url = format(baseUrl, "2");
  return crawlerUtils.attemptDataExtractionFromUrl(url, parse);
}

module.exports = preDb;
