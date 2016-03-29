template = require './torrentActions.html'

mod = angular
      .module('torrentActions-directive', [])
      .directive 'torrentActions', [ 'torrentService', (torrentService) ->
        template: template,
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
          torrent: '=',
          onlyStart: '='
        },
        link: (scope) ->
          scopeUpdateClosures = {}

          scopeUpdateClosures.startLoading = ->
            scope.loading = true
            return

          scopeUpdateClosures.stopLoading = ->
            scope.loading = false
            return

          scope.startDownload = (torrentDefinition) ->
            scope.loading = true
            setTimeout( ->
              console.log 'Starting'
              scope.loading = false
              return
            ,3000);

            #torrentService.startDownload(torrentDefinition, scopeUpdateClosures)
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
