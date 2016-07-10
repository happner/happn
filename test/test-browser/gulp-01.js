var gulp = require('gulp');
var Server = require('karma').Server;
var happn = require('../../lib/index');
var service = happn.service;
var happnInstance;

/**
 * Run test once and exit
 */
gulp.task('default', function (done) {

  service.create({
      secure: true,
      encryptPayloads: true,
      services: {
        security: {
          config: {
            keyPair: {
              privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
              publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
            }
          }
        }
      }
    },
    function (e, happnInst) {

      if (e)
        return callback(e);

      happnInstance = happnInst;

      new Server({
        configFile: __dirname + '/01.karma.conf.js',
        singleRun: true
      }, done).start();

    });


});
