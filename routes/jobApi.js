var router = require('./router');
var debug = require('debug')('tvster');
var jobService = require('../services/jobService');


/**
 GET /api/jobs
 */
router.get('/api/jobs', function(req,res){
   debug('Return all jobs');
   res.json({resp: 'All jobs'})
 });

/**
 GET /api/jobs/rename
 */
router.get('/api/jobs/rename', function(req, res) {

  debug('About to create a rename job...');

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
