var express = require('express');
var router = express.Router();
var filebotService = require('../services/filebotService');

// get /status
router.get('/', function (req, res) {
  res.json({ status: 'OK'});
});

router.get('/filebot', function(req, res) {
  var status = filebotService.getFilebotInfo();
  res.json(status);
});

module.exports = router;
