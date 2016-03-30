automatedSearch = require "./components/automatedSearch/automatedSearch"
feeds = require "./components/feeds/feeds"
torrentsStatus = require "./components/torrentsStatus/torrentsStatus"
search = require "./components/search/search"
torrentSingleDownload =
    require './components/torrentSingleDownload/torrentSingleDownload'
# angular-materialize = require ''
angularMaterialize = require 'angular-materialize'

app = window.app = angular.module 'dutilsApp', ['ngRoute'
    'ngResource'
    'ui.bootstrap'
    angularMaterialize
    automatedSearch
    feeds
    torrentsStatus
    search
    torrentSingleDownload
]

app.config ['$routeProvider','$httpProvider','$interpolateProvider','$compileProvider', ($routeProvider, $httpProvider, $interpolateProvider, $compileProvider) ->
  $interpolateProvider.startSymbol('[[').endSymbol(']]')
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|magnet):/)

  $httpProvider.defaults.transformRequest = (data) ->
    if !data
      return data
    else
      json = angular.toJson data
      if data.name?
        json = "{" + "\"" + data.name + "\": " + json + "}"
        return json
      else
        return json
]
