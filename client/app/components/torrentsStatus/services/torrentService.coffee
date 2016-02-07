module.exports = mod = ($http, $timeout) ->

  baseUrl = "api/torrents"
  startUrl = baseUrl + "/start" # provide object with magnet link / torrent link
  cancelUrl = baseUrl + "/cancel" # provide GUID
  pauseUrl = baseUrl + "/pause" # provide GUID
  resumeUrl = baseUrl + "/resume" # provide GUID
  renameUrl = baseUrl + "/rename" # provide GUID
  subtitlesUrl = baseUrl + "/subtitles" # provide GUID
  pollStatusUrl = baseUrl + "/status"

  pollPromise = null
  torrentService = {}

  addCallbacks = (promise, successCallback, errorCallback) ->
    return promise.success(successCallback).error(errorCallback)

  torrentService.getAll = ->
    return $http.put(pollStatusUrl).then( (resp) ->
      return resp.data.torrents
    )

  torrentService.torrentAction = (action, torrent, successCallback, errorCallback) ->
    if action is "START"
      dataObject = {
        torrent: torrent
      }
      res = $http.post(startUrl, dataObject)
    else if action is "CANCEL"
      url = cancelUrl + "/" + (torrent.hash || torrent.guid)
      console.log "Cancel url " + url
      res = $http.delete(url)
    else if action is "PAUSE"
      url = pauseUrl + "/" + torrent.hash
      res = $http.put(url)
    else if action is "RESUME"
      url = resumeUrl + "/" + torrent.hash
      res = $http.put(url)
    else if action is "RENAME"
      url = renameUrl
      res = $http.put(url)
    else if action is "SUBTITLES"
      url = subtitlesUrl
      res = $http.put(url)
    else
      console.log "Action not recognised " + action

    addCallbacks(res, successCallback, errorCallback)
    return

  torrentService.pollTorrentsStatus = (successCallback, errorCallback) ->
    res = $http.put(pollStatusUrl)
    addCallbacks(res, successCallback, errorCallback)
    return res

  torrentService.stopPolling = ->
    if pollPromise? && angular.isDefined(pollPromise)
      $timeout.cancel(pollPromise)
    return

  torrentService.pollForStatus =  ->
    return $http.put(pollStatusUrl).then (resp) ->
      pollPromise = $timeout(torrentService.pollForStatus(updateAction), 5000)
      return resp.data.torrents

  startTorrentDownloadSuccessCallbackCreator = (torrentDefinition, stopLoadingClosure) ->
    return (responseData, status, headers, config) ->
      #responseData.torrent.date = moment(responseData.torrent.date).format('YYYY-MM-DD')
      _.extend torrentDefinition, responseData.torrent
      stopLoadingClosure()
      return

  cancelTorrentDownloadSuccessCallbackCreator = (torrentDefinition) ->
    return (responseData, status, headers, config) ->
      torrentDefinition.state = "NEW"
      torrentDefinition.buttonText = "Start"
      return

  pauseTorrentSuccessCallbackCreator = (torrentDefinition) ->
    return (responseData, status, headers, config) ->
      _.extend torrentDefinition, responseData.torrent
      return

  resumeTorrentSuccessCallbackCreator = (torrentDefinition, stopLoadingClosure) ->
    return (responseData, status, headers, config) ->
      _.extend torrentDefinition, responseData.torrent
      stopLoadingClosure()
      return

  torrentService.startDownload = (torrentDefinition, scopeUpdateClosures) ->
    torrentDownload = {}
    date = moment(torrentDefinition.date).format('YYYY-MM-DD[T]HH:mm:ssZZ')
    # copies properties over from 2 to 1 - torrentDefinition to torrentDownload
    _.extend torrentDownload, torrentDefinition
    torrentDownload.date = date
    scopeUpdateClosures.startLoading()
    successCallback = startTorrentDownloadSuccessCallbackCreator(torrentDefinition, scopeUpdateClosures.stopLoading)
    torrentService.torrentAction("START",torrentDownload,successCallback,onError)
    return

  torrentService.cancelDownload = (torrentDefinition) ->
    torrentDefinition.buttonText = "Cancelling..."
    successCallback = cancelTorrentDownloadSuccessCallbackCreator(torrentDefinition)
    torrentService.torrentAction("CANCEL",torrentDefinition,successCallback,onError)
    return

  torrentService.pauseDownload = (torrentDefinition) ->
    torrentDefinition.buttonText = "Pausing..."
    successCallback = pauseTorrentSuccessCallbackCreator(torrentDefinition)
    torrentService.torrentAction("PAUSE",torrentDefinition,successCallback,onError)
    return

  torrentService.resumeDownload = (torrentDefinition, scopeUpdateClosures) ->
    torrentDefinition.buttonText = "Resuming..."
    scopeUpdateClosures.startLoading()
    successCallback = resumeTorrentSuccessCallbackCreator(torrentDefinition, scopeUpdateClosures.stopLoading)
    torrentService.torrentAction("RESUME",torrentDefinition,successCallback,onError)
    return

  torrentService.fetchSubtitles = (torrentDefinition) ->
    torrentDefinition.buttonText = "Fetching..."
    successCallback = pauseTorrentSuccessCallbackCreator(torrentDefinition)
    torrentService.torrentAction("SUBTITLES",torrentDefinition,successCallback,onError)
    return

  torrentService.rename = (torrentDefinition) ->
    torrentDefinition.buttonText = "Renaming..."
    successCallback = pauseTorrentSuccessCallbackCreator(torrentDefinition)
    torrentService.torrentAction("RENAME",torrentDefinition,successCallback,onError)
    return

  onError = (responseData) ->
    console.log("Error in request")
    return

  return torrentService

mod.$inject = ['$http', '$timeout']
