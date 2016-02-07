require '../renderTorrentState/renderTorrentState.coffee'
require '../torrentActions/torrentActions.coffee'

template = require './torrentsTable.html'
app.directive 'torrentsTable', [ "$sce", ($sce) ->
  template: template,
  restrict: 'E',
  replace: true,
  transclude: true,
  scope: {
    torrents: '='
    fields: '@'
    actions: '@'
    filterState: '@'
  },
  controller: 'searchController'
  link: (scope, iElement, iAttrs, controller) ->
    # specific, private to the table
    scope.fieldLabels = scope.fields.split(',')
    scope.torrentsInState = []

    scope.processField = (torrent, fieldLabel) ->
      processedField = ""
      normalizedFieldLabel = fieldLabel.toLowerCase()

      if normalizedFieldLabel is 'size'
        processedField = if torrent.size? then torrent.size + " MB" else "N/A"
      else if normalizedFieldLabel is 'seeds'
        processedField = if torrent.seeds? then torrent.seeds else 'N/A'
      else if normalizedFieldLabel is 'date'
        processedField = moment(torrent.date, 'YYYY-MM-DD').format('YYYY-MM-DD')
      else if normalizedFieldLabel is 'percentdone'

        if torrent.percentDone?
          percent = parseInt(torrent.percentDone)
        else
          percent = 0

        progressTemplate = "<div class=\"progress\"> " +
                           "<div class=\"progress-bar-success\" role=\"progressbar\" aria-valuenow=\"1\" " +
                           "aria-valuemin=\"0\" aria-valuemax=\"100\" style=\"width: " + percent + "%; min-width:20px\"> " +
                           percent + "% " +
                           " </div> " +
                           "</div>"

        processedField = progressTemplate
      else
        processedField = torrent[normalizedFieldLabel]
      return $sce.trustAsHtml(processedField)

    return
]
