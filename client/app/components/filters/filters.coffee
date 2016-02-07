
mod = angular
      .module('filters',[])
      .filter 'torrentsByState', ->
        return (inputs, targetState) ->
          inputs = inputs || {}
          filtered = []
          
          if not targetState
            filtered = inputs
          else
            acceptedStates = targetState.split(",")
            angular.forEach inputs, (input) ->
              if _.contains acceptedStates, input.state
                filtered.push input
              return

          return filtered

module.exports = mod.name
