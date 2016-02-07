searchUtils = module.exports = {}

searchUtils.computeSitesParam = (searchSites) ->
  sitesParam = ""
  _.each searchSites, (elem, index, list) ->
    sitesParam = sitesParam + elem.id + ","
    return
  # remove last comma
  sitesParam = sitesParam.replace(/,$/, "")
  return sitesParam
