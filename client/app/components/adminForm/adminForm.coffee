template = require './adminForm.html'
mod = angular
  .module("adminForm-directive", [])
  .directive 'adminForm', ->
    template: template,
    restrict: 'E',
    replace: true,
    transclude: false,
    scope: {
      fields: '='
      submitText: '='
      formTitle: '=title'
      submitAction: '&'
    },
    link: (scope) ->
      return

module.exports = mod.name
