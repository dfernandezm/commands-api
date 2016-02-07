mod = angular.module('torrentApi', [])

mod.factory 'torrentService', require './services/torrentService'

module.exports = mod.name
