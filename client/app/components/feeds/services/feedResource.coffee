 module.exports = mod = ($resource) ->
    # Make use of the resource plugin: path, attribute - path override (feedId is the id field in the
    # resolved object), list of methods to override
    Feed = $resource 'api/feeds/:feedId', {feedId: '@id'}, {
      getAll: { method: 'GET', params: {}, isArray: true },
      update: { method: 'PUT' },
      deleteFeed: { method: 'DELETE' }
    }
    # We attach the name of the attribute to send to the server to create a request like
    # { feed: {...} } (see setup.coffee)
    Feed.prototype.name = 'feed'
    # Coffescript syntax: return the above created "class"
    return Feed
