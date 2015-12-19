var Job = require ('../models').job;
var jobService = {};

jobService.persist = function (job, resultClosures) {
  console.log("About to create job...", job);
  console.log("Model job", Job);
  // Use Create!
  var builtJob = Job.build(job);
  builtJob.save()
    .then(resultClosures.success)
    .catch(resultClosures.error);
}

module.exports = jobService;
