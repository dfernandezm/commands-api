var sequelize = require('../models').sequelize;
var log = require('./logger');

var transactionUtilsService = {};

transactionUtilsService.currentTransaction = {};

transactionUtilsService.executeInTransactionWithResult = function(promiseChainClosure) {
  return sequelize.transaction(function (transaction) {
    return promiseChainClosure(transaction);
  }).then(function(result) {
     log.debug("Transaction committed.")
     return result;
  }).catch(function(err) {
    var msg = "Error executing transaction -- " + err;
    log.error(msg);
    return {error: msg};
  });
}

module.exports = transactionUtilsService;
