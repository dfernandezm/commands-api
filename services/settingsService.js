var _ = require('lodash');
var sequelize = require('../models').sequelize;
var log = require('./logger');

var TransmissionSettings = require('../models').transmissionSettings;
var MediacenterSettings = require('../models').mediacenterSettings;

var settingsService = {};

// Consider default the id = 1
function findOne(model, transaction) {
  return model.findOne({
    where: {id: 1},
    transaction: transaction
  });
}

settingsService.updateSettings = function (settingsObject) {
  return sequelize.transaction(function (t) {

    return findOne(TransmissionSettings, t).then(function(tSettings) {
        console.log('Here1: ',tSettings);
        return tSettings.update(settingsObject,{transaction: t});
    }).then(function(resultTs) {
      return findOne(MediacenterSettings, t).then(function(mSettings) {
        console.log('Here2: ',mSettings);
        return mSettings[0].update(settingsObject,{transaction: t});
      }).then(function(resultMs){
        return {transmissionSettings: resultTs.toJSON(), mediacenterSettings: resultMs.toJSON()}
      });
    });

  }).then(function (result) {
    // Transaction has been committed
    // result is whatever the result of the promise chain returned to the transaction callback
    console.log("committed transaction to update settings", result);

    // The chain is here resolved to the result of the promise in the chain --
    // we collect here the result to returned to the 'then' part of the caller
    return result;
  }).catch(function (err) {
    // Transaction has been rolled back
    // err is whatever rejected the promise chain returned to the transaction callback

    // Catch rejects the promise so this return value goes straight to 'then'
    // part of the caller. This is ok, as there we just want the result, success
    // or error, as a JS object to serialize
    return {error: "Error executing transaction -- " + err};
  });
}

settingsService.getDefaultTransmissionSettings = function() {
  return TransmissionSettings.findById(1).then(function(ts) {
    log.info("Successfully got transmission settings");
    return ts;
  })
}

module.exports = settingsService;
