template = require './progressBar.html'

mod = angular
      .module('progressBar-directive',[])
      .directive 'progressBar', [ ->
        template: template,
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
         percent: '='
        },
        link: (scope, iElement, iAttrs, controller) ->
          return
      ]
      
module.exports = mod.name
