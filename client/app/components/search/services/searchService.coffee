module.exports = mod = ($http) ->

    # Returns a promise which once resolved will give a torrentsInfo object containing
    # the list of torrents fetch
    searchTorrents = (searchQuery, sitesParam, scopeUpdateClosures) ->
      req = {
        method: 'get',
        url: 'api/search',
        params: { searchQuery : searchQuery, sitesParam: sitesParam }
      }
      promise = $http(req)
      successCallback = _getSuccessCallback(scopeUpdateClosures.success)
      errorCallback = _getErrorCallback(scopeUpdateClosures.error)
      promise.success(successCallback).error(errorCallback)
      return

    _getSuccessCallback = (scopeUpdateClosure) ->
      return (responseData) ->
        torrentsInfo = _modifyTorrentsResponse(responseData.torrentsInfo)
        # Closure which updates the scope with response data
        scopeUpdateClosure(torrentsInfo)
        return

    _getErrorCallback = (scopeUpdateClosure) ->
      return (responseData) ->
        scopeUpdateClosure(responseData)
        console.log("Error in request")
        return

    _modifyTorrentsResponse = (torrentsInfo) ->
      _.map torrentsInfo.torrents, (torrent) ->
        torrent.buttonText = if torrent.state == 'NEW' then "Download" else "Cancel"
        torrent.date = moment(torrent.date, 'YYYY-MM-DD').format('YYYY-MM-DD')
      return torrentsInfo


    return {
      searchTorrents: searchTorrents
    }

mod.$inject = ['$http']
