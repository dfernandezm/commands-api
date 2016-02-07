 module.exports = mod = ($resource) ->
    # Make use of the resource plugin: path, attribute - path override (asId is the id field in the
    # resolved object), list of methods to override
    AutomatedSearch = $resource 'api/automatedsearchs/:asId', {asId: '@id'}, {
      getAll: { method: 'GET', params: {}, isArray: true },
      update: { method: 'POST' },
      remove: { method: 'DELETE' }
    }
    # We attach the name of the attribute to send to the server to create a request like
    # { automatedSearch: {...} } (see setup.coffee)
    AutomatedSearch.prototype.name = 'automatedSearch'
    # Coffescript syntax: return the above created "class"
    return AutomatedSearch
