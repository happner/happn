describe('d3-security-tokens', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;

  var test_secret = 'test_secret';
  var default_timeout = 10000;
  var happnInstance = null;

  var primusClient;

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  after(function (done) {
    happnInstance.stop(done);
  });

  before('should initialize the service, set up the users and groups', function (callback) {

    this.timeout(20000);

    try {
      service.create(function (e, happnInst) {
        if (e)
          return callback(e);

        happnInstance = happnInst;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });

  var serviceConfig = {
    services:{
      security: {
        config: {
          keyPair: {
            privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
            publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
          },
          profiles:[
            {
              name:"web-session",
              map:{
                user:['WEB_SESSION'],
                is_token:1
              },
              policy:{
                session_inactivity_threshold:2000
              }
            }, {
              name:"connected-device",
              map:{
                group:['CONNECTED_DEVICES']
              },
              policy: {
                timeout: {
                  token_ttl: 2000,
                  token_renewable:true,
                  is_token:1
                }
              }
            }, {
              name:"stateful-ws",
              map:{
                group:['STATEFUL_SESSIONS']
              },
              policy: {
                timeout: {
                  token_ttl: 2000,
                  token_renewable:true,
                  is_token:1
                }
              }
            }, {
              name:"default",
              map:{default:true},
              policy: {
                token_ttl: Infinity,
                token_renewable:false,
                session_inactivity_threshold:Infinity
              }
            }
          ]
        }
      }
    }
  };


  xit('should login with a web session based profile - session timeout should happen', function (callback) {

  });

  xit('should login with a connected device profile - session should go stale, token is renewable using key based cryptography', function (callback) {

  });

  xit('log in using a stateful ws session - session should only lapse on disconnection', function (callback) {

  });

  xit('log in using the default profile - session should only lapse on disconnection', function (callback) {

  });


  require('benchmarket').stop();

});
