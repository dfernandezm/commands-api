var TransmissionSettings = require ('../models').transmissionSettings;
var transmissionService = {};

var Powersteer = require('powersteer');

var transmissionClient = new Powersteer({
    url: 'http://:9091/transmission/rpc',
    username: '',
    password: ''
});

transmissionService.testConnection = function () {
  console.log("Testing connection to transmission...");

  return transmissionClient.sessionGet().then(function(result) {
    console.log("Connection to transmission successful", result);
    return result;
  }).catch(function(error) {
    console.log("Error connecting to transmission...", error);
  });

}

module.exports = transmissionService;
