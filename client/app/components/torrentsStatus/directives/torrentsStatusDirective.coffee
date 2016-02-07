torrentElements = require '../../torrentList/torrentElements/torrentElements'
torrentApi = require '../torrentApi'
template = require './torrentsStatus.html'

mod = angular
      .module('torrentsStatus-directive', [torrentElements, torrentApi, 'ui.bootstrap'])
      .directive 'torrentsStatus', [ 'torrentService', '$timeout', (torrentService, $timeout)  ->
        restrict: 'E',
        replace: true,
        transclude: true,
        template: template,
        scope: {},
        link: (scope) ->

          pollPromise = null

          scope.$on('$destroy', ->
            # Make sure that the interval is destroyed too
            torrentService.stopPolling(pollPromise)
            return
          )

          scope.onSuccess = (data) ->
            scope.torrents = data.torrents
            pollPromise = $timeout(scope.pollForStatus, 5000)
            return data.torrents

          scope.onError = (data) ->
            console.log 'ERROR'
            return

          scope.pollForStatus =  ->
            return torrentService.pollTorrentsStatus scope.onSuccess, scope.onError

          # This is here because the scope needs to be updated with fetched data
          scope.pollForStatus()
          
      ]

module.exports = mod.name
