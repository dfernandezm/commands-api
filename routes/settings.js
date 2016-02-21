var router = require('./router');
var debug = require('debug')('tvster');
var settingsService = require('../services/settingsService');
var TransmissionSettings = require('../models').transmissionSettings;
var MediacenterSettings = require('../models').mediacenterSettings;


/**
 GET /api/search?searchQuery=XX&sitesParam=YY
 */
router.get('/api/settings', function(req, res) {


   settingsService.updateSettings({ port: 9191,
                                    baseLibraryPath: '/mediacenter'})
                                    .then(function(result) {
                                      res.json(result);
                                    });

});

module.exports = router;
