module.exports = function (app) {
    app.use('/', require('./general'));
    app.use('/api/status', require('./status'));
};
