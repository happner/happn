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
          sessionTokenSecret:"absolutely necessary if you want tokens to carry on working after a restart",
          keyPair: {
            privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
            publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
          },
          profiles:[ //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
            {
              name:"web-session",
              map:{
                user:['WEB_SESSION'],
                session_type:1//token stateless
              },
              policy:{
                session_ttl: Infinity,
                session_inactivity_threshold:2000//this is costly, as we need to store state on the server side
              }
            }, {
              name:"connected-device",
              map:{
                group:['CONNECTED_DEVICES'],
                public_key:['AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'],
                session_type:1//token stateless
              },
              policy: {
                session_ttl: 2000,//stale after 2 seconds
                token_renewable:true,//renew requests allowed
                token_renew_limit:2000,//not renewable after 2 seconds of being stale
              }
            },
            {
              name:"trusted-connected-device",
              map:{
                group:['TRUSTED_CONNECTED_DEVICES'],
                public_key:['AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'],
                session_type:1//token stateless
              },
              policy: {
                session_ttl: 2000,//token never goes stale
                token_renewable:true,//renew requests allowed
                token_renew_limit:Infinity,//as long as this device possesses the above public key, it can renew its old token at any time
              }
            },{
              name:"stateful-ws",
              map:{
                group:['STATEFUL_SESSIONS'],
                session_type:0//stateful
              },
              policy: {
                token_ttl: Infinity,

              }
            }, {
              name:"default-ws",// this is the default underlying profile for ws sessions
              map:{
                session_type:0//stateful
              },
              policy: {
                session_ttl: Infinity,
                token_renewable:false,
                session_inactivity_threshold:Infinity
              }
            }, {
              name:"default-http",// this is the default underlying profile for ws sessions
              map:{
                session_type:1//token stateless
              },
              policy: {
                session_ttl: 60000,//session goes stale after a minute
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
