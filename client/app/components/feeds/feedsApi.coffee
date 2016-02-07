mod = angular.module('feedsApi', [])

mod.factory 'Feed', ['$resource', require './services/feedResource']
mod.factory 'feedService', require './services/feedService'

module.exports = mod.name
