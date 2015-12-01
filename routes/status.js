var express = require('express');
var router = express.Router();
var filebotService = require('../services/filebotService');
var shellService = require('../services/shellService');

// get /status
router.get('/', function (req, res) {
  res.json({ status: 'OK'});
});

router.get('/filebot', function(req, res) {
  console.log("Filebot Service ", filebotService);
  filebotService.getFilebotInfo();

  var status = shellService.checkExecutable('filebot');
  var shellExecute = shellService.executeWithCallback('ls -l');
  res.json(status);

  //res.json({ status: 'OK from Filebot'});
});

module.exports = router;
