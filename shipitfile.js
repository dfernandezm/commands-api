// Requires rsync to be installed, both locally and remotely
module.exports = function (shipit) {

  require('shipit-deploy')(shipit);
  var path = require('path');

  shipit.initConfig({
    default: {
      workspace: '/tmp/tvster-deploy',
      deployTo: '/home/osmc/install/tvster',
      repositoryUrl: 'https://github.com/dfernandezm/tvster.git',
      ignores: ['.git', 'node_modules', 'models_test', 'docker-osx-dev-master',
                'client/node_modules', '*.md', '.DS_Store', 'docker', 'deploy'],
      rsync: ['--del'],
      keepReleases: 2,
      key: '/Users/david/.ssh/id_rsa',
      shallowClone: true,
      branch: 'feature/shipit-deploy'
    },
    staging: {
      servers: 'osmc@192.168.1.74'
    }
  });

  shipit.on('fetched', function() {
    return shipit.start('buildClient');
  });

  shipit.on('updated', function() {
    return shipit.start('installAndMigrations');
  });

  shipit.on('deployed', function() {
    console.log("New version of application deployed, stopping and starting...");
    return shipit.start('stopOldStartNew');
  });

  shipit.blTask('buildClient', function() {
    console.log("Path is: ", shipit.config.workspace);
    return shipit.local('npm install && npm run prod', { cwd: shipit.config.workspace + '/client' }).then(function(res) {
      console.log(res.stdout);
      console.log(res.stderr);
    });
  });

  shipit.blTask('installAndMigrations', function() {
    var releasePath = path.join(shipit.releasesPath, shipit.releaseDirname);
    console.log('ReleasePath: ', releasePath);
    return shipit.remote('cd ' + releasePath + ' && npm install').then(function (res) {
      console.log(res.stdout);
      console.log(res.stderr);
      var sequelizePath = 'node_modules/sequelize-cli/bin';
      // Check hook variable in Shipit docs.
      var env = 'staging';
      //var configPath = releasePath + '/config/config.json';
      return shipit.remote('cd ' + releasePath + ' && ' + sequelizePath + '/sequelize db:migrate --env ' + env).then(function (res2) {
        console.log(res2.stdout);
        console.log(res2.stderr);
        // return stopOld
      });
    });
  });

  shipit.blTask('stopOldStartNew', function() {
    return shipit.remote("forever list | grep 'bin/www' | awk -F ' ' '{print $3}'").then(function (processId) {
            console.log("Current processId is ", processId[0].stdout);
            console.log("Length of that line is " + processId[0].stdout.length);
            var line = processId[0].stdout;

            if (processId[0].stdout.length > 0) {
                var procIdRegex = /forever\/(.*)\.log/;
                console.log("line is " + line);
                var match = procIdRegex.exec(line);
                if (match.length > 0) {
                    console.log(match);
                    var processGuid = match[1];
                    console.log("Stop current application with ID " + processGuid + " from regex before starting new one...");
                    return shipit.remote('forever stop ' + processGuid).then(function() {
                        return startNewApp();
                    });
                } // else kill all
            } else {
                console.log("Starting new application");
                return startNewApp();
            }
    });
  });

  function startNewApp() {
    var currentPath = path.join(shipit.config.deployTo, 'current');
    console.log('Starting new version on ' + currentPath);
    return shipit.remote('cd ' + currentPath + ' && forever start bin/www');
  }

};
