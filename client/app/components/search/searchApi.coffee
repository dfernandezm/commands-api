mod = angular.module('searchApi', [])

mod.factory 'searchService', require './services/searchService'

module.exports = mod.name
