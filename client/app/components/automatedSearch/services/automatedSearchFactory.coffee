module.exports = mod =  (AutomatedSearch) ->

  getAll =  ->
    return AutomatedSearch.getAll((data) ->
      console.log("Get all " + data)
    )

  save = (automatedSearch) ->
    # CoffeeScript here: this function returns a promise to the result (notice
    # there is no return statement in the main function)
    automatedSearch.$save((savedAutomatedSearch) ->
      console.log("Saved automatedSearch")
      return savedAutomatedSearch
    )

  update = (automatedSearch) ->
    automatedSearch.$update((updatedAutomatedSearch) ->
        console.log("Updated automatedSearch")
        return updatedAutomatedSearch
    )

  remove = (automatedSearch) ->
    automatedSearch.$delete((data) ->
      console.log("AutomatedSearch deleted!")
    )

  return {
    getAll: getAll
    save: save
    update: update
    remove: remove
  }

mod.$inject = ['AutomatedSearch']
