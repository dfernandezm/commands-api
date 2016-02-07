adminForm = require '../../adminForm/adminForm'
adminTable = require '../../adminTable/adminTable'
feedsApi = require '../feedsApi'
formUtils = require '../../util/formUtils'

template = require './feeds.html'
mod = angular
      .module('feeds-directive',[adminForm, adminTable, feedsApi])
      .directive 'feeds', [ 'Feed', 'feedService', (Feed, feedService)  ->
        restrict: 'E'
        replace: true
        transclude: false
        template: template
        scope: {}
        link: (scope) ->
          scope.formSpec = require './feedsFormSpecification.json'
          scope.feeds = feedService.getAll()

          scope.newFeed =  ->
            scope.formSpec.submitText = "Add"
            scope.formSpec.title = "Add new feed"
            scope.formSpec.action = "ADD"
            scope.showForm = true
            scope.feed = new Feed()
            formUtils.clearForm(scope.formSpec.fields)
            return

          scope.deleteFeed = (feed) ->
            feedService.remove(feed).then ( (data) ->
                scope.feeds = feedService.getAll()
                return
            )
            return

          scope.editFeed = (feed) ->
            scope.formSpec.submitText = "Update"
            scope.formSpec.title = "Update feed"
            scope.formSpec.action = "UPDATE"
            scope.showForm = true
            scope.feed = feed
            formUtils.fillForm(scope.formSpec.fields, scope.feed)
            return

          scope.action = ->
            formUtils.collectValues(scope.formSpec.fields, scope.feed)
            if scope.formSpec.action is 'ADD'
               feedService.save(scope.feed).then( (savedFeed) ->
                 scope.feeds.push(savedFeed)
                 scope.showForm = false
                 return
               )
            else if scope.formSpec.action is 'UPDATE'
              feedService.update(scope.feed).then( (updatedFeed) ->
                scope.feeds = feedService.getAll()
                scope.showForm = false
                return
              )
            return

          return
      ]

module.exports = mod.name

# ------------- TO BE DELETED --------------
# fillForm = ->
#   for field in scope.formSpec.fields
#     field.value = scope.feed[field.name]
#   return
#
# collectValues =  ->
#   for field in scope.formSpec.fields
#     scope.feed[field.name] = field.value
#   return
#
# clearForm = ->
#   for field in scope.formSpec.fields
#     field.value = null
#   return
# -------------------------------------------
