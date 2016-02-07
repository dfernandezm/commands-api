#torrentActions = require '../torrentList/torrentActions/torrentActions'
template = require './torrentSingleDownload.html'

mod = angular
      .module('torrentSingleDownload-directive',[])
      .directive 'torrentSingleDownload', [ ->
        template: template,
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {},
        link: (scope) ->
          scope.torrent = { state: 'NEW' }

          scope.populateTorrent = ->
            if _.startsWith(scope.magnetOrTorrentLink, "magnet:")
              scope.torrent.magnetLink = scope.magnetOrTorrentLink
            else
              scope.torrent.torrentFileLink = scope.magnetOrTorrentLink
            return

          return
      ]

module.exports = mod.name
