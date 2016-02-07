mod = angular.module('automatedSearchApi', [])

# Careful, if we try to inject in the automatedSearchResource through
# mod.inject it does not work after minification
automatedSearchResource = require './services/automatedSearchResource'
automatedSearchFactory = require './services/automatedSearchFactory'
mod.factory 'AutomatedSearch', ['$resource', automatedSearchResource]
mod.factory 'automatedSearchFactory',

module.exports = mod.name
