template = require './torrentActions.html'

mod = angular
      .module('torrentActions-directive', [])
      .directive 'torrentActions', [ 'torrentService', (torrentService) ->
        template: template,
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
          torrent: '='
        },
        link: (scope) ->
          scopeUpdateClosures = {}
          scopeUpdateClosures.startLoading = ->
            console.log("==== inside start loading ====")
            scope.loading = true
            return

          scopeUpdateClosures.stopLoading = ->
            scope.loading = false
            return

          scope.startDownload = (torrentDefinition) ->
            torrentService.startDownload(torrentDefinition, scopeUpdateClosures)
            return

          scope.pauseDownload = (torrentDefinition) ->
            torrentService.pauseDownload(torrentDefinition)
            return

          scope.cancelDownload = (torrentDefinition) ->
            torrentService.cancelDownload(torrentDefinition)
            return

          scope.resumeDownload = (torrentDefinition) ->
            torrentService.resumeDownload(torrentDefinition, scopeUpdateClosures)
            return

          scope.rename = (torrentDefinition) ->
            torrentService.rename(torrentDefinition)
            return

          scope.fetchSubtitles = (torrentDefinition) ->
            torrentService.fetchSubtitles(torrentDefinition)
            return

          return
      ]

module.exports = mod.name
