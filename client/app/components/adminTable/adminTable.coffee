template = require './adminTable.html'
mod = angular
  .module("adminTable-directive", [])
  .directive 'adminTable', ->
    template: template,
    restrict: 'E',
    replace: true,
    transclude: false,
    scope: {
      items: '='
      fields: '=' # Maybe One way value
      # Pass in a function (Angular expression) which will be evaluated in the
      # parent scope of this directive (see template)
      # With this we decouple the actual action to update away from the
      # directive itself, so we can re-use it in any controller
      updateAction: '&'
      deleteAction: '&'
    },
    link: (scope, iElement, iAttrs) ->
      console.log 'Calling link() in the adminTable'
      scope.isUpdateActionDefined = iAttrs.updateAction?
      scope.isDeleteActionDefined = iAttrs.deleteAction?
      scope.select = (item) ->
        scope.selected = item
        return
      return

module.exports = mod.name
