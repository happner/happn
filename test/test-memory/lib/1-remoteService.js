/**
 * Created by johan on 3/31/16.
 */

var happn = require('../../../lib/index');
var service = happn.service;

var test_secret = 'test_secret';
var happnInstance = null;


service.create({
  mode: 'embedded',
  port: 8001,
  services: {
    auth: {
      path: './services/auth/service.js',
      config: {
        authTokenSecret: 'a256a2fd43bf441483c5177fc85fd9d3',
        systemSecret: test_secret
      }
    },
    data: {
      path: './services/data_embedded/service.js',
      config: {}
    },
    pubsub: {
      path: './services/pubsub/service.js'
    }
  },
  utils: {
    log_level: 'info|error|warning',
    log_component: 'prepare'
  }
}, function (e, happnInst) {
  if (e)
    return callback(e);

  happnInstance = happnInst;
});