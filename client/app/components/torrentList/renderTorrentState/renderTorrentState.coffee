template = require './renderTorrentState.html'

mod = angular
      .module('renderTorrentState-directive', [])
      .directive 'renderTorrentState', [ ->
        template: template,
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
         torrent: '='
        },
        link: (scope) ->
          scope.stateConfig = require './config/stateConfig.json'
          return
      ]

module.exports = mod.name
