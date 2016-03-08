var Job = require ('../models').job;
var log = require('./logger');
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

jobService.createJob = function (jobSpec) {
  log.debug("Creating job: ", jobSpec);
  return Job.create(jobSpec);
}

jobService.findByGuid = function(jobGuid) {
  return Job.findOne({ where: { guid: jobGuid} });
}

jobService.updateJob = function(job) {
  return jobService.findByGuid(job.guid).then(function(foundJob) {
    if (foundJob) {
      _.extend(foundJob, job);
    } else {
      throw {name: "UNKNOWN_JOB",
             message: "Job with GUID " + job.guid + " not found",
             status: 404};
    }
  });
}

module.exports = jobService;
