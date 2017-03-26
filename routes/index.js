module.exports = function (app) {
  //TODO: Check how to the routes are matched (order)
  //if (utils.isWorker()) {
      app.use('/', require('./general'));
 // } else {
      app.use('/api/search', require('./search'));
      app.use('/api/status', require('./status'));
      app.use('/api/settings', require('./settings'));
      app.use('/api/torrents', require('./torrent'));
  //}

};
