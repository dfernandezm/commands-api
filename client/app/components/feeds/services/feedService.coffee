module.exports = mod =  (Feed) ->

  getAll =  ->
    return Feed.getAll((data) ->
      console.log("Get all " + data)
    )

  save = (feed) ->
    # the parameter 'savedFeed' is the saved value coming from the server
    # CoffeeScript here: this function returns a promise to the result (notice
    # there is no return statement in the main function)
    feed.$save((savedFeed) ->
      console.log(savedFeed)
      return savedFeed
    )

  update = (feed) ->
    feed.$update((updatedFeed) ->
        console.log("Updated " + feed)
        # $scope.feed = null
        # $scope.showFeedsForm = false
        return updatedFeed
    )

  remove = (feed) ->
    feed.$delete((data) ->
      console.log("Feed deleted!")
      #$scope.feed = null
      #$scope.feeds = getAllFeeds()
    )

  return {
    getAll: getAll
    save: save
    update: update
    remove: remove
  }

mod.$inject = ['Feed']
