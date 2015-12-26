var router = require('./router');
var debug = require('debug')('commands-api');
var jobService = require('../services/jobService');

/**
 GET /api/jobs/filebot
 */
router.get('/filebot', function(req, res) {

  debug('About to create job...');

  resultClosures = {};
  resultClosures.success = function(newJob) {
    debug(newJob.get({plain: true}));
    res.json({job: newJob});
  };
  resultClosures.error = function(error) {
    debug(error);
    res.json({error: error})
  }
  jobService.persist({
     jobType: 'FILEBOT_RENAME',
     state: 'RUNNING'
  }, resultClosures);

});

module.exports = router;
