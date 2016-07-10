var expect = require('expect.js');
var happn = require('../lib/index')
var service = happn.service;
var happn_client = happn.client;
var async = require('async');
var request = require('request');

describe('7_browser-client-test', function () {
  var test_secret = 'test_secret';
  var happnInstance = null;

  /*
   This test demonstrates starting up the happn service - 
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  it('should initialize the service', function (callback) {

    this.timeout(20000);

    try {
      service.create({
          mode: 'embedded',
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
              path: './services/pubsub/service.js',
              config: {"security-mode": 'unsecure'}
            }
          },
          utils: {
            log_level: 'info|error|warning',
            log_component: 'prepare'
          }
        },
        function (e, happn) {
          if (e)
            return callback(e);

          happnInstance = happn;
          callback();
        });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {
    happnInstance.stop(done);
  });

  it('should fetch the browser client', function (callback) {

    this.timeout(5000);

    try {

      require('request')({
          uri: 'http://127.0.0.1:55000/browser_client',
          method: 'GET'
        },
        function (e, r, b) {

          if (!e) {
            ////console.log('got body!!!');
            ////console.log(b);
            callback();
          } else
            callback(e);


        });

    } catch (e) {
      callback(e);
    }
  });

});
