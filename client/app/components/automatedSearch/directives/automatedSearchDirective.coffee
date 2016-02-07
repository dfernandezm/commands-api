
# Injects the factory/service
# Requires the adminForm, adminTable
# The template of this directive has adminForm and adminTable directives
# All the functions needed in the template are in the link function of this directive
# Do any filters
# require '../torrentElement/torrentElement.coffee'
 # mod = angular
 #       .module 'dutils-automated-search-directive', []
      # require '../../adminForm/adminForm.coffee'
      # require '../../adminTable/adminTable.coffee'
#])
adminForm = require '../../adminForm/adminForm'
adminTable = require '../../adminTable/adminTable'
automatedSearchApi = require '../automatedSearchApi'
formUtils = require '../../util/formUtils'
template = require './automatedSearch.html'

mod = angular
      .module('automatedSearch-directive',[adminForm, adminTable, automatedSearchApi])
      .directive 'automatedSearch',[ 'AutomatedSearch', 'automatedSearchFactory', (AutomatedSearch, automatedSearchFactory) ->
        restrict: 'E'
        replace: true
        transclude: false
        scope: {}
        template: template
        link: (scope) ->
          console.log("The automated search call")
          scope.formSpec = require './automatedSearchFormSpecification.json'
          scope.automatedSearchs = automatedSearchFactory.getAll()

          # Underscore ._where Looks through each value in the list, returning an array of all
          # the values that contain all of the key-value pairs listed in properties.
          scope.automatedSearchFieldsForTable = _.where scope.formSpec.fields, {showInTable: true}

          scope.newAutomatedSearch =  ->
            scope.formSpec.submitText = "Add"
            scope.formSpec.title = "Add new TV Show"
            scope.formSpec.action = "ADD"
            scope.showForm = true
            scope.automatedSearch = new AutomatedSearch()
            formUtils.clearForm(scope.formSpec.fields)
            return

          scope.deleteAutomatedSearch = (automatedSearch) ->
            automatedSearchFactory.remove(automatedSearch).then ( (data) ->
                scope.automatedSearchs = automatedSearchFactory.getAll()
                return
            )
            return

          scope.editAutomatedSearch = (automatedSearch) ->
            scope.formSpec.submitText = "Update"
            scope.formSpec.title = "Update TV Show"
            scope.formSpec.action = "UPDATE"
            scope.showForm = true
            scope.automatedSearch = automatedSearch
            formUtils.fillForm(scope.formSpec.fields, scope.automatedSearch)
            return

          scope.action = ->
            formUtils.collectValues(scope.formSpec.fields, scope.automatedSearch)
            scope.automatedSearch.contentType = "TV_SHOW"
            if scope.formSpec.action is 'ADD'
               automatedSearchFactory.save(scope.automatedSearch).then( (data) ->
                 scope.automatedSearchs.push(data.automatedSearch)
                 scope.showForm = false
                 return
               )
            else if scope.formSpec.action is 'UPDATE'
              automatedSearchFactory.update(scope.automatedSearch).then( (updated) ->
                scope.automatedSearchs = automatedSearchFactory.getAll()
                scope.showForm = false
                return
              )
            return

          return
      ]

module.exports = mod.name
