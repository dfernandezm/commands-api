renderTorrentState = require '../renderTorrentState/renderTorrentState'
torrentActions = require '../torrentActions/torrentActions'
progressBar = require '../../progressBar/progressBar'
template = require './torrentElement.html'
templateCompact = require './torrentElementCompact.html'

mod = angular
      .module('torrentElement-directive', [torrentActions, renderTorrentState, progressBar])
      .directive 'torrentElement', [  ->
        template: templateCompact,
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
          torrent: '=',
          style: '=',
          showProgress: '='
        },
        link: (scope) ->
          #TODO: Convert into a filter
          scope.fieldFormat = (field, torrent) ->
            if field is 'size'
              processedField = if torrent.size? then torrent.size + " MB" else ""
            else if field is 'seeds'
              processedField = if torrent.seeds? then torrent.seeds + " seeds" else 'N/A'
            else if field is 'date'
              processedField = moment(torrent.date, 'YYYY-MM-DD').format('YYYY-MM-DD')
            else if field is 'title'
              processedField = torrent.title
            else
              processedField = torrent[field]
            return processedField
          return
      ]

module.exports = mod.name
