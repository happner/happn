describe('d3-security-tokens', function () {

  // TODO:benchmarket stuff
  // require('benchmarket').start();
  // after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var async = require('async');
  var uuid = require('node-uuid');
  var Logger = require('happn-logger');
  var CheckPoint = require('../lib/services/security/checkpoint');
  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  // after(function (done) {
  //   happnInstance.stop(done);
  // });

  var serviceConfig = {
    services:{
      security: {
        config: {
          sessionTokenSecret:"TESTTOKENSECRET",
          keyPair: {
            privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
            publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
          },
          profiles:[ //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
            {
              name:"web-session",
              session:{
                $and:[{
                  user:{username:{$eq:'WEB_SESSION'}},
                  type:{$eq:0}
                }]
              },
              policy:{
                ttl: '4 seconds',
                inactivity_threshold:'2 seconds'//this is costly, as we need to store state on the server side
              }
            }, {
              name:"rest-device",
              session:{
                $and:[{ //filter by the security properties of the session - check if this session user belongs to a specific group
                user:{groups:{"REST_DEVICES" : { $exists: true }}},
                type:{$eq:0} //token stateless
              }]
              },
              policy: {
                ttl: 2000,//stale after 2 seconds
                inactivity_threshold:'2 days' //stale after 2 days
              }
            },{
              name:"trusted-device",
              session:{
                $and:[{ //filter by the security properties of the session, so user, groups and permissions
                user:{groups:{
                  "TRUSTED_DEVICES" : { $exists: true }
                }},
                type:{$eq:1} //stateful connected device
              }]},
              policy: {
                ttl: '2 seconds',//stale after 2 seconds
                permissions:{//permissions that the holder of this token is limited, regardless of the underlying user
                  '/TRUSTED_DEVICES/*':{actions: ['*']}
                }
              }
            },{
              name:"specific-device",
              session:{$and:[{ //instance based mapping, so what kind of session is this?
                type:{$in:[0,1]}, //any type of session
                ip_address:{$eq:'127.0.0.1'}
              }]},
              policy: {
                ttl: Infinity,//this device has this access no matter what
                inactivity_threshold:Infinity,
                permissions:{//this device has read-only access to a specific item
                  '/SPECIFIC_DEVICE/*':{actions: ['get','on']}
                }
              }
            },
            {
              name:"non-reusable",
              session:{$and:[{ //instance based mapping, so what kind of session is this?
                user:{groups:{
                  "LIMITED_REUSE" : { $exists: true }
                }},
                type:{$in:[0,1]} //stateless or stateful
              }]},
              policy: {
                usage_limit:2//you can only use this session call twice
              }
            }, {
              name:"default-stateful",// this is the default underlying profile for stateful sessions
              session:{
                $and:[{type:{$eq:1}}]
              },
              policy: {
                ttl: Infinity,
                inactivity_threshold:Infinity
              }
            }, {
              name:"default-stateless",// this is the default underlying profile for ws sessions
              session:{
                $and:[{type:{$eq:0}}]
              },
              policy: {
                ttl: 60000 * 10,//session goes stale after 10 minutes
                inactivity_threshold:Infinity
              }
            }
          ]
        }
      }
    }
  };

  var getService = function (config, callback) {
    happn.service.create(config,
      function(e, instance){
        if (e) return callback(e);
        callback(null, instance);
      }
    );
  };

  var stopService = function (instance, callback) {
      instance.stop({reconnect:false},callback);
  };

  var mockServices = function(callback, servicesConfig){

    var testConfig = {
      secure:true,
      services:{
        cache:{},
        data:{},
        crypto:{},
        security:{}
      }
    };

    var testServices = {};

    testServices.cache = require('../lib/services/cache/service');
    testServices.crypto = require('../lib/services/crypto/service');
    testServices.data = require('../lib/services/data/service');
    testServices.security = require('../lib/services/security/service');
    testServices.session = require('../lib/services/session/service');
    testServices.utils = require('../lib/services/utils/service');
    testServices.error = require('../lib/services/error/service');
    testServices.log = require('../lib/services/log/service');

    var checkpoint = require('../lib/services/security/checkpoint');

    testServices.checkpoint = new checkpoint({logger: Logger});

    var happnMock = {services: {}};

    if (servicesConfig) testConfig = servicesConfig;

    async.eachSeries(['log','error','utils', 'crypto', 'cache', 'session','data', 'security'], function (serviceName, eachServiceCB) {

      testServices[serviceName] = new testServices[serviceName]({logger: Logger});
      testServices[serviceName].happn = happnMock;

      happnMock.services[serviceName] = testServices[serviceName];

      if (serviceName == 'error') happnMock.services[serviceName].handleFatal = function(message, e){
        console.log('FATAL FAILURE:::', message);
        throw e;
      };

      if (serviceName == 'session') {
        happnMock.services[serviceName].config = {};
        return happnMock.services[serviceName].initializeCaches(eachServiceCB);
      }

      if (!happnMock.services[serviceName].initialize) return eachServiceCB();

      else testServices[serviceName].initialize(happnMock.services[serviceName], eachServiceCB);

    }, function(e){

      if (e) return callback(e);
      callback(null, happnMock);

    });
  };

  it ('should test the session filtering capability', function(done){

    var sift = require('sift');

    var testSession = {
      user:{
        username:'WEB_SESSION'
      },
      type:0
    };

    var testSessionNotFound = {
      user:{
        username:'WEB_SESSION'
      },
      type:1
    };

    var foundItem = sift(serviceConfig.services.security.config.profiles[0].session, [testSession]);

    expect(foundItem.length).to.be(1);

    var notFoundItem = sift(serviceConfig.services.security.config.profiles[0].session, [testSessionNotFound]);

    expect(notFoundItem.length).to.be(0);

    var foundInGroupItem = sift(serviceConfig.services.security.config.profiles[0].session, [testSessionNotFound, testSession]);

    expect(foundInGroupItem.length).to.be(1);

   var testSession1 = {
     user:{
       groups:{
         'REST_DEVICES':{
            permissions:{}
         }
       }
     },
     type:0
   };

    var foundItemProfile1 = sift(serviceConfig.services.security.config.profiles[1].session, [testSession1]);

    expect(foundItemProfile1.length).to.be(1);

    var testSession2 = {
      user:{
        groups:{
          'TRUSTED_DEVICES':{
            permissions:{}
          }
        }
      },
      type:1
    };

    var foundItemProfile2 = sift(serviceConfig.services.security.config.profiles[2].session, [testSession2, testSession1]);

    expect(foundItemProfile2.length).to.be(1);

    expect(foundItemProfile2[0].user.groups.TRUSTED_DEVICES).to.not.be(null);
    expect(foundItemProfile2[0].user.groups.TRUSTED_DEVICES).to.not.be(undefined);

    done();

  });

  it('should test the sign and fail to verify function of the crypto service, bad digest', function(done){

    mockServices(function(e, happnMock){

      if (e) return done(e);

      var Crypto = require('happn-util-crypto');
      var crypto = new Crypto();

      var testKeyPair = crypto.createKeyPair();

      var nonce = crypto.createHashFromString(uuid.v4().toString());
      var digest = crypto.sign(nonce, testKeyPair.privateKey);

      var verifyResult = happnMock.services.crypto.verify(nonce, 'a dodgy digest', testKeyPair.publicKey);

      expect(verifyResult).to.be(false);

      done();

    });

  });

  it('should test the sign and fail to verify function of the crypto service, bad nonce', function(done){

    mockServices(function(e, happnMock){

      if (e) return done(e);

      var Crypto = require('happn-util-crypto');
      var crypto = new Crypto();

      var testKeyPair = crypto.createKeyPair();

      var nonce = crypto.createHashFromString(uuid.v4().toString());
      var digest = crypto.sign(nonce, testKeyPair.privateKey);

      var verifyResult = happnMock.services.crypto.verify('a dodgy nonce', digest, testKeyPair.publicKey);

      expect(verifyResult).to.be(false);

      done();

    });

  });

  it('should test the sign and verify function of the crypto service', function(done){

    mockServices(function(e, happnMock){

      if (e) return done(e);

      var Crypto = require('happn-util-crypto');
      var crypto = new Crypto();

      var testKeyPair = crypto.createKeyPair();

      var nonce = crypto.createHashFromString(uuid.v4().toString());
      var digest = crypto.sign(nonce, testKeyPair.privateKey);

      var verifyResult = happnMock.services.crypto.verify(nonce, digest, testKeyPair.publicKey);

      expect(verifyResult).to.be(true);

      done();

    });

  });

  it('should test the sign and verify function of the crypto service, from a generated nonce', function(done){

    mockServices(function(e, happnMock){

      if (e) return done(e);

      var Crypto = require('happn-util-crypto');
      var crypto = new Crypto();

      var testKeyPair = crypto.createKeyPair();

      var nonce = happnMock.services.crypto.generateNonce();
      var digest = crypto.sign(nonce, testKeyPair.privateKey);

      var verifyResult = happnMock.services.crypto.verify(nonce, digest, testKeyPair.publicKey);

      expect(verifyResult).to.be(true);

      done();

    });

  });


  it('should test the default config settings', function(done){

    var happn = require('../lib/index')
    var happn_client = happn.client;

    var clientInstance = happn_client.__instance({
      username:'_ADMIN',
      keyPair:{
        publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
        privateKey:'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
      }
    });

    expect(clientInstance.options.config.publicKey).to.be('AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2');
    expect(clientInstance.options.config.privateKey).to.be('Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=');

    var clientInstance = happn_client.__instance({
      username:'_ADMIN',
      publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
      privateKey:'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
    });

    expect(clientInstance.options.config.publicKey).to.be('AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2');
    expect(clientInstance.options.config.privateKey).to.be('Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=');

    var clientInstance = happn_client.__instance({
      username:'_ADMIN',
      password: 'happntest'
    });

    expect(clientInstance.options.config.username).to.be('_ADMIN');
    expect(clientInstance.options.config.password).to.be('happntest');

    var clientInstance = happn_client.__instance({
      config:{
        username:'_ADMIN',
        password: 'happntest'
      }
    });

    expect(clientInstance.options.config.username).to.be('_ADMIN');
    expect(clientInstance.options.config.password).to.be('happntest');

    done();

  });

  it('should test the __prepareLogin method, password', function(done){

    var happn = require('../lib/index')
    var happn_client = happn.client;

    var Crypto = require('happn-util-crypto');
    var crypto = new Crypto();

    var nonce;

    var clientInstance = happn_client.__instance({
      username:'_ADMIN',
      password:'happnTestPWD'
    });

    clientInstance.serverInfo = {};

    var loginParameters = {
      username:clientInstance.options.config.username,
      password:'happnTestPWD'
    };

    clientInstance.performRequest = function(path, action, data, options, cb){
      cb(new Error('this wasnt meant to happn'));
    };

    //loginParameters, callback
    clientInstance.__prepareLogin(loginParameters, function(e, prepared){

      if (e) return callback(e);

      expect(prepared.username).to.be(clientInstance.options.config.username);
      expect(prepared.password).to.be('happnTestPWD');

      done();

    });

  });

  it('should test the __prepareLogin method, digest', function(done){

    var happn = require('../lib/index')
    var happn_client = happn.client;

    var Crypto = require('happn-util-crypto');
    var crypto = new Crypto();

    var nonce;

    var clientInstance = happn_client.__instance({
      username:'_ADMIN',
      keyPair:{
        publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
        privateKey:'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
      }
    });

    clientInstance.serverInfo = {};

    var loginParameters = {
      username:clientInstance.options.config.username,
      publicKey:clientInstance.options.config.publicKey,
      loginType:'digest'
    };

    clientInstance.performRequest = function(path, action, data, options, cb){

      var nonce_requests = {};

      if (!options) options = {};

      if (action == 'request-nonce'){

        nonce = crypto.generateNonce();

        var request = {
          nonce:nonce,
          publicKey:data.publicKey
        };

        nonce_requests[nonce] = request;

        cb(null, {nonce:nonce});
      }
    };

    clientInstance.__ensureCryptoLibrary(function(e){

      if (e) return callback(e);

      //loginParameters, callback
      clientInstance.__prepareLogin(loginParameters, function(e, prepared){

        if (e) return callback(e);

        var verificationResult = crypto.verify(nonce, prepared.digest, clientInstance.options.config.publicKey);

        expect(verificationResult).to.be(true);

        done();

      });
    });
  });

  it('should test the login function of the happn client, passing in a digest', function(){

    var happn = require('../lib/index');
    var happn_client = happn.client;

    var clientInstance = happn_client.__instance({
        username:'_ADMIN',
        keyPair:{
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
          privateKey:'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
        }
    });

    clientInstance.performRequest = function(path, action, data, options, callback){

        var nonce_requests = {};

        mockServices(function(e, happnMock){

        if (action == 'request-nonce'){

          var Crypto = require('happn-util-crypto');
          var crypto = new Crypto();

          var nonce = crypto.generateNonce();

          var request = {
            nonce:nonce,
            publicKey:data.publicKey
          };

          nonce_requests[nonce] = request;

          request.__timedOut = setTimeout(function(){

            delete nonce_requests[this.nonce];

          }.bind(request), 3000);

          callback(null, nonce);
        }

        if (action == 'login'){

          if (data.digest){

            if (nonce_requests[data.nonce] !== null){

              clearTimeout(nonce_requests[data.nonce].__timedOut);

              happnMock.services.crypto.verify(data.nonce, data.digest, data.publicKey);

            } else callback(new Error('could not find nonce request for nonce: ' + data.nonce));
          }
        }

        clientInstance.login();

      });
    }
  });

  it("tests the security checkpoints __createPermissionSet function", function(done){

    var checkpoint = new CheckPoint({
      logger:require('happn-logger')
    });

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    checkpoint.securityService = {
      getGroup:function(groupName, opts, callback){

        if (groups[groupName]) callback(null, groups[groupName]);

      },
      happn:{
        services:{
          utils:utils
        }
      }
    };

    var permissions = {
      '/test/group/explicit':{action:['set']},
      '/test/group/*':{action:['*']},
      '/test/group/*':{action:['*']}
    };

    var permissionSet = checkpoint.__createPermissionSet(permissions);

    expect(permissionSet.explicit['/test/group/explicit'].action[0]).to.be('set');
    expect(permissionSet.wildcard['/test/group/*'].action[0]).to.be('*');
    expect(Object.keys(permissionSet.wildcard).length).to.be(1);

    done();

  });

  it("tests the security checkpoints __loadPermissionSet function", function(done){

    var groups = {
      'TEST_GROUP':{
        permissions:{
          '/test/group/explicit':{action:['set']},
          '/test/group/*':{action:['*']}
        }
      },
      'TEST_GROUP_1':{
        permissions:{
          '/test/group/*':{action:['*']}
        }
      }
    };

    var identity = {
      user:{
        groups:groups
      }
    };

    var checkpoint = new CheckPoint({
      logger:require('happn-logger')
    });

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    checkpoint.securityService = {
      users:{
        getGroup:function(groupName, opts, callback){

          if (groups[groupName]) callback(null, groups[groupName]);

        }
      },
      happn:{
        services:{
          utils:utils
        }
      }
    };

    checkpoint.__loadPermissionSet(identity, function(e, permissionSet){

      if (e) return done(e);

      expect(permissionSet.explicit['/test/group/explicit'].action[0]).to.be('set');
      expect(permissionSet.wildcard['/test/group/*'].action[0]).to.be('*');
      expect(Object.keys(permissionSet.wildcard).length).to.be(1);

      done();


    });

  });

  it("tests the security checkpoints __authorized function", function(done){

    var groups = {
      'TEST_GROUP':{
        permissions:{
          '/test/explicit':{actions:['set']},
          '/test/wild/*':{actions:['*']}
        }
      },
      'TEST_GROUP_1':{
        permissions:{
          '/test/wild/*':{actions:['*']}
        }
      }
    };

    var identity = {
      user:{
        groups:groups
      }
    };

    var checkpoint = new CheckPoint({
      logger:require('happn-logger')
    });

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    checkpoint.securityService = {
      users:{
        getGroup:function(groupName, opts, callback){

          if (groups[groupName]) callback(null, groups[groupName]);

        }
      },
      happn:{
        services:{
          utils:utils
        }
      }
    };

    checkpoint.__loadPermissionSet(identity, function(e, permissionSet){

      if (e) return done(e);

      expect(permissionSet.explicit['/test/explicit'].actions[0]).to.be('set');
      expect(permissionSet.wildcard['/test/wild/*'].actions[0]).to.be('*');
      expect(Object.keys(permissionSet.wildcard).length).to.be(1);


      expect(checkpoint.__authorized(permissionSet, '/test/explicit', 'set')).to.be(true);
      expect(checkpoint.__authorized(permissionSet, '/test/wild/blah', 'on')).to.be(true);
      expect(checkpoint.__authorized(permissionSet, '/test/explicit/1', 'set')).to.be(false);
      expect(checkpoint.__authorized(permissionSet, '/test', 'get')).to.be(false);

      done();

    });
  });

  it('tests the security services __profileSession method, default profiles', function(done){

    var session = {
      user:{
        username:'WEB_SESSION'
      }
    };

    mockServices(function(e, happnMock){

      if (e) return done(e);

      happnMock.services.security.__profileSession(session);

      expect(session.policy[0].ttl).to.be(2592000000);
      expect(session.policy[1].ttl).to.be(2592000000);

      expect(session.policy[0].inactivity_threshold).to.be(Infinity);
      expect(session.policy[1].inactivity_threshold).to.be(Infinity);

      done();

    }, serviceConfig);

  });

  it('tests the security services authorize method', function(done){

    mockServices(function(e, happnMock){

      if (e) return done(e);

      var session = {
        type:0,
        user:{
          username:'BLAH'
        },
        policy: {
          1: {
            ttl: 2000
          },
          0: {
            ttl: 4000
          }
        }
      };

      happnMock.services.security.__checkRevocations = function(session, cb){
        cb(null, true);
      };

      happnMock.services.security.authorize(session, null, null, function(e){

        expect(e).to.not.be(null);
        expect(e).to.not.be(undefined);

        session.bypassAuthUser = true;
        happnMock.services.security.authorize(session, null, null, done);
      });

    });

  });

  it("tests the security checkpoints _authorizeSession ttl", function(done){

    this.timeout(20000);

    var checkpoint = new CheckPoint({
      logger: require('happn-logger')
    });

    var CacheService = require('../lib/services/cache/service');
    var cacheInstance = new CacheService();

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    cacheInstance.happn = {
      services:{
        utils:utils
      }
    };

    cacheInstance.initialize({}, function(e) {

      if (e) return done(e);

      var securityService = {
        users:{
          getGroup:function(groupName, opts, callback){
            if (groups[groupName]) callback(null, groups[groupName]);
          }
        },
        happn:{
          services:{
            utils:utils
          }
        },
        cacheService: cacheInstance,
        onDataChanged: function () {}
      };

      var testSession = {
        id: 99,
        type: 1,
        timestamp: Date.now(),
        policy: {
          1: {
            ttl: 2000
          },
          0: {
            ttl: 4000
          }
        }
      };

      checkpoint.happn = {
        services:{
          utils:utils,
          cache:cacheInstance
        }
      };

      checkpoint.initialize({}, securityService, function (e) {

        if (e) return done(e);

        checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e){

          if (e) return done(e);

          setTimeout(function(){

            checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e, authorized, reason){

              expect(authorized).to.be(false);
              expect(reason).to.be('expired session token');

              testSession.type = 0;

              //we have a more permissive ttl for stateless sessions
              checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e, authorized){

                expect(authorized).to.be(true);

                done();
              });
            });
          }, 2500);
        });
      })
    });
  });

  it("tests the security checkpoints _authorizeSession inactivity_threshold timed out", function(done){

    this.timeout(20000);

    var checkpoint = new CheckPoint({
      logger: require('happn-logger')
    });

    var CacheService = require('../lib/services/cache/service');
    var cacheInstance = new CacheService();

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    cacheInstance.happn = {
      services:{
        utils:utils
      }
    };

    cacheInstance.initialize({}, function(e) {

      if (e) return done(e);

      var securityService = {
        users:{
          getGroup:function(groupName, opts, callback){
            if (groups[groupName]) callback(null, groups[groupName]);
          }
        },
        happn:{
          services:{
            utils:utils
          }
        },
        cacheService: cacheInstance,
        onDataChanged: function () {}
      };

      var testSession = {
        id:99,
        type:1,
        timestamp:Date.now(),
        policy:{
          1:{
            ttl:6000,
            inactivity_threshold:1000
          },
          0:{
            ttl:5000,
            inactivity_threshold:10000
          }
        }
      };

      checkpoint.happn = {
        services:{
          utils:utils,
          cache:cacheInstance
        }
      };

      checkpoint.initialize({}, securityService, function (e) {

        if (e) return done(e);

        setTimeout(function () {

          checkpoint._authorizeSession(testSession, '/test/blah', 'on', function (e, authorized, reason) {

            if (e) return done(e);

            expect(authorized).to.be(false);
            expect(reason).to.be('session inactivity threshold reached');

            testSession.type = 0;//should be fine - plenty of time

            checkpoint._authorizeSession(testSession, '/test/blah', 'on', function (e, authorized) {

              expect(authorized).to.be(true);
              done();

            });
          });
        }, 1500);
      });
    });
  });

  it("tests the security checkpoints _authorizeSession inactivity_threshold active then timed out", function(done){

    this.timeout(20000);

    var checkpoint = new CheckPoint({
      logger: require('happn-logger')
    });

    var CacheService = require('../lib/services/cache/service');
    var cacheInstance = new CacheService();

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    cacheInstance.happn = {
      services:{
        utils:utils
      }
    };

    cacheInstance.initialize({}, function(e) {

      if (e) return done(e);

      var securityService = {
        users:{
          getGroup:function(groupName, opts, callback){
            if (groups[groupName]) callback(null, groups[groupName]);
          }
        },
        happn:{
          services:{
            utils:utils
          }
        },
        cacheService: cacheInstance,
        onDataChanged: function () {}
      };

      var testSession = {
        id:99,
        type:1,
        timestamp:Date.now(),
        policy:{
          1:{
            ttl:6000,
            inactivity_threshold:1000
          },
          0:{
            ttl:5000,
            inactivity_threshold:10000
          }
        }
      };

      checkpoint.happn = {
        services:{
          utils:utils,
          cache:cacheInstance
        }
      };

      checkpoint.initialize({}, securityService, function (e) {

        if (e) return done(e);

        checkpoint._authorizeSession(testSession, '/test/blah', 'on', function (e, authorized) {

          if (e) return done(e);

          expect(authorized).to.be(true);

          setTimeout(function () {

            checkpoint._authorizeSession(testSession, '/test/blah', 'on', function (e, authorized, reason) {

              expect(authorized).to.be(false);
              expect(reason).to.be('session inactivity threshold reached');

              done();

            });

          }, 1500);
        });
      });
    });
  });

  it("tests the security checkpoints _authorizeSession inactivity_threshold keep-alive", function(done){

    this.timeout(20000);

    var checkpoint = new CheckPoint({
      logger: require('happn-logger')
    });

    var CacheService = require('../lib/services/cache/service');
    var cacheInstance = new CacheService();

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    cacheInstance.happn = {
      services:{
        utils:utils
      }
    };

    cacheInstance.initialize({}, function(e) {

      if (e) return done(e);

      var securityService = {
        users:{
          getGroup:function(groupName, opts, callback){
            if (groups[groupName]) callback(null, groups[groupName]);
          }
        },
        happn:{
          services:{
            utils:utils
          }
        },
        cacheService: cacheInstance,
        onDataChanged: function () {}
      };

      var testSession = {
        id: 99,
        type: 1,
        timestamp: Date.now(),
        policy: {
          1: {
            inactivity_threshold:2000
          },
          0: {
            inactivity_threshold:2000
          }
        }
      };

      checkpoint.happn = {
        services:{
          utils:utils,
          cache:cacheInstance
        }
      };

      checkpoint.initialize({}, securityService, function(e) {

        if (e) return done(e);

        var counter = 0;

        var checkSessionIsAlive = function(){

          checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e, authorized){

            expect(authorized).to.be(true);

            if (counter < 3){

              counter++;

              setTimeout(function(){

                checkSessionIsAlive();

              }, 1200);

            }else{

              testSession.type = 0;

              setTimeout(function(){

                return checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e, authorized, reason){

                  expect(authorized).to.be(false);
                  expect(reason).to.be('session inactivity threshold reached');

                  done();
                });

              }, 2100);
            }
          });
        };

        checkSessionIsAlive();

      });
    });
  });

  it("tests the security checkpoints _authorizeSession inactivity_threshold", function(done){

    this.timeout(20000);

    var checkpoint = new CheckPoint({
      logger: require('happn-logger')
    });

    var CacheService = require('../lib/services/cache/service');
    var cacheInstance = new CacheService();

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    cacheInstance.happn = {
      services:{
        utils:utils
      }
    };

    var testSession = {
      id: 99,
      type: 1,
      timestamp: Date.now(),
      policy: {
        1: {
          inactivity_threshold:2000
        },
        0: {
          inactivity_threshold:2000
        }
      }
    };

    var securityService = {
      users:{
        getGroup:function(groupName, opts, callback){
          if (groups[groupName]) callback(null, groups[groupName]);
        }
      },
      happn:{
        services:{
          utils:utils
        }
      },
      cacheService: cacheInstance,
      onDataChanged: function () {}
    };

    checkpoint.happn = {
      services:{
        utils:utils,
        cache:cacheInstance,
        security:securityService
      }
    };

    cacheInstance.initialize({}, function(e) {

      if (e) return done(e);

      checkpoint.initialize({}, securityService, function(e) {

        if (e) return done(e);

        checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e, authorized){

          expect(authorized).to.be(true);

          setTimeout(function(){

            checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e, authorized, reason) {

              expect(authorized).to.be(false);
              expect(reason).to.be('session inactivity threshold reached');

              done();

            });

          }, 2100);
        });
      });
    });
  });

  it("tests the security checkpoints _authorizeSession permissions passthrough", function(done) {

    this.timeout(20000);

    var checkpoint = new CheckPoint({
      logger: require('happn-logger')
    });

    var CacheService = require('../lib/services/cache/service');
    var cacheInstance = new CacheService();

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    cacheInstance.happn = {
      services:{
        utils:utils
      }
    };

    var testSession = {
      id: 99,
      type: 0,
      timestamp: Date.now(),
      policy: {
        1: {
          ttl: 6000,
          inactivity_threshold: 1000
        },
        0: {
          ttl: 15000,
          inactivity_threshold: 2000,
          permissions:{
            '/test/permission/*':{actions:['*']}
          }
        }
      }
    };

    var securityService = {
      users:{
        getGroup:function(groupName, opts, callback){
          if (groups[groupName]) callback(null, groups[groupName]);
        }
      },
      happn:{
        services:{
          utils:utils
        }
      },
      cacheService: cacheInstance,
      onDataChanged: function () {}
    };

    checkpoint.happn = {
      services:{
        utils:utils,
        cache:cacheInstance,
        security:securityService
      }
    };

    cacheInstance.initialize({}, function(e) {

      if (e) return done(e);

      checkpoint.initialize({}, securityService, function (e) {

        if (e) return done(e);

        checkpoint._authorizeSession(testSession, '/test/permission/24', 'on', function (e, authorized, reason, passthrough1) {

          if (e) return done(e);

          expect(passthrough1).to.be(true);

          checkpoint._authorizeSession(testSession, '/test1/permission/24', 'on', function (e, authorized, reason, passthrough2) {

            if (e) return done(e);

            expect(passthrough2).to.be(undefined);
            expect(authorized).to.be(false);

            done();

          });
        });
      });
    });
  });

  it("tests the security checkpoints token usage limit", function(done) {

    this.timeout(20000);

    this.timeout(20000);

    var checkpoint = new CheckPoint({
      logger: require('happn-logger')
    });

    var CacheService = require('../lib/services/cache/service');
    var cacheInstance = new CacheService();

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    cacheInstance.happn = {
      services:{
        utils:utils
      }
    };

    var testSession = {
      id: 99,
      type: 0,
      timestamp: Date.now(),
      policy: {
        1: {
          usage_limit:2,
          ttl:2000
        },
        0: {
          usage_limit:1,
          ttl:2000
        }
      }
    };

    var securityService = {
      users:{
        getGroup:function(groupName, opts, callback){
          if (groups[groupName]) callback(null, groups[groupName]);
        }
      },
      happn:{
        services:{
          utils:utils
        }
      },
      cacheService: cacheInstance,
      onDataChanged: function () {}
    };

    checkpoint.happn = {
      services:{
        utils:utils,
        cache:cacheInstance,
        security:securityService
      }
    };

    cacheInstance.initialize({}, function(e) {

      if (e) return done(e);

      checkpoint.initialize({}, securityService, function(e){

        if (e) return done(e);

        checkpoint.__checkUsageLimit(testSession, testSession.policy[1], function(e, ok){

          if (e) return done(e);

          expect(ok).to.be(true);

          checkpoint.__checkUsageLimit(testSession, testSession.policy[1], function(e, ok){

            if (e) return done(e);

            checkpoint.__checkUsageLimit(testSession, testSession.policy[1], function(e, ok){

              if (e) return done(e);

              expect(ok).to.be(false);

              done();

            });
          });
        });
      });
    });
  });

  var mockRequest = function(token, url, payload, method){

    if (!token) throw new Error('you must specify a token');
    if (!url) throw new Error('you must specify an url');
    if (method.toLowerCase() == 'post' && !payload) throw new Error('you must specify an url');

    if (!method) method = 'GET';

    var MockRequest = require('./helpsrs/mock_request');

    var request = new MockRequest({
      method: method.toUppserCase(),
      url: url,
      headers: {
        'Accept': 'application/json'
      }
    });

    request.write(payload);

    request.end();

    return request;

  };

  var mockLoginRequest = function(credentials, callback){

    var MockRequest = require('./helpsrs/mock_request');

    var request = new MockRequest({
      method: 'POST',
      url: '/auth/login',
      headers: {
        'Accept': 'application/json'
      }
    });

    request.write(credentials);
    request.end();

    return request;

  };

  it('tests the security services generateToken and decodeToken methods', function(done){

    mockServices(function(e, happnMock){

      if (e) return done(e);

      var session = {

        id: 1,
        isToken:true,
        username: 'TEST',
        timestamp: Date.now(),
        ttl: 3000,
        permissions:{}

      };

      var token = happnMock.services.security.generateToken(session);
      var decoded = happnMock.services.security.decodeToken(token);

      for (var propertyName in session){
        expect(JSON.stringify(session[propertyName])).to.be(JSON.stringify(decoded[propertyName]));
      }

      done();

    }, serviceConfig);

  });

  it('tests the security services createAuthenticationNonce and verifyAuthenticationDigest methods', function (done) {

    this.timeout(5000);

    var happn = require('../lib/index');
    var happn_client = happn.client;

    var clientInstance = happn_client.__instance({
      username:'_ADMIN',
      keyPair:{
        publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
        privateKey:'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
      }
    });

    clientInstance.__ensureCryptoLibrary(function(e) {

      if (e) return callback(e);

      mockServices(function (e, happnMock) {

        var mockSession = {
          publicKey: "AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2"
        };

        expect(happnMock.services.security.config.defaultNonceTTL).to.be(60000);

        happnMock.services.security.createAuthenticationNonce(mockSession, function (e, nonce) {

          if (e) return done(e);

          mockSession.digest = clientInstance.__signNonce(nonce);

          happnMock.services.security.verifyAuthenticationDigest(mockSession, function (e, verified) {

            if (e) return done(e);
            expect(verified).to.be(true);

            done();

          });

        });

      }, serviceConfig);

    });

  });

  it('tests the security services createAuthenticationNonce method, timing out', function (done) {

    this.timeout(5000);

    var happn = require('../lib/index');
    var happn_client = happn.client;

    var clientInstance = happn_client.__instance({
      username:'_ADMIN',
      keyPair:{
        publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
        privateKey:'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
      }
    });

    clientInstance.__ensureCryptoLibrary(function(e) {

      if (e) return callback(e);

      mockServices(function (e, happnMock) {

        var mockSession = {
          publicKey: "AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2"
        };

        expect(happnMock.services.security.config.defaultNonceTTL).to.be(60000);

        happnMock.services.security.config.defaultNonceTTL = 500;//set it to something small

        happnMock.services.security.createAuthenticationNonce(mockSession, function (e, nonce) {

          if (e) return done(e);

          mockSession.digest = clientInstance.__signNonce(nonce);

          setTimeout(function(){

            happnMock.services.security.verifyAuthenticationDigest(mockSession, function (e) {

              expect(e.toString()).to.be('Error: nonce expired or public key invalid');

              done();

            });
          }, 1000);
        });
      }, serviceConfig);
    });
  });

  it('should create a user with a public key, then login using a signature', function (done) {

    this.timeout(20000);

    var config =  {
      secure:true,
      sessionTokenSecret:"absolutely necessary if you want tokens to carry on working after a restart",
      profiles:[
          {
            name:"web-session",
            session:{
              user:{username:{$eq:'WEB_SESSION'}},
              type:{$eq:0}
            },
            policy:{
              ttl: 4000,
              inactivity_threshold:2000//this is costly, as we need to store state on the server side
            }
          }
        ]
      };

    getService(config, function (e, instance) {

      if (e) return done(e);

      var testGroup = {
        name: 'CONNECTED_DEVICES',
        permissions:{
          '/CONNECTED_DEVICES/*':{actions: ['*']}
        }
      };

      var testUser = {
        username: 'WEB_SESSION',
        publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
      };

      var addedTestGroup;
      var addedTestuser;

      var testClient;
      var serviceInstance = instance;

      serviceInstance.services.security.users.upsertGroup(testGroup, {overwrite: false}, function (e, result) {

        if (e) return done(e);
        addedTestGroup = result;

        serviceInstance.services.security.users.upsertUser(testUser, {overwrite: false}, function (e, result) {

          if (e) return done(e);
          addedTestuser = result;

          serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser, function (e) {

            if (e) return done(e);

            happn.client.create({

              username: testUser.username,
              publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
              privateKey:'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
              loginType:'digest'

              })

              .then(function (clientInstance) {

                clientInstance.disconnect(function(e){
                  if (e) console.warn('couldnt disconnect client:::', e);
                  serviceInstance.stop(done);
                })

              })

              .catch(function (e) {
                done(e);
              });

          });
        });
      });
    });
  });

  it('should create a user with a public key, then fail login to a using a signature - bad public key', function (done) {

    this.timeout(20000);

    var config =  {
      secure:true,
      sessionTokenSecret:"absolutely necessary if you want tokens to carry on working after a restart",
      profiles:[
        {
          name:"web-session",
          session:{
            user:{username:{$eq:'WEB_SESSION'}},
            type:{$eq:0}
          },
          policy:{
            ttl: 4000,
            inactivity_threshold:2000//this is costly, as we need to store state on the server side
          }
        }
      ]
    };

    var CryptoService = require('../lib/services/crypto/service');
    var crypto = new CryptoService({logger: Logger});

    crypto.initialize({}, function(e){

      if (e) return done(e);

      getService(config, function (e, instance) {

        if (e) return done(e);

        var testGroup = {
          name: 'CONNECTED_DEVICES',
          permissions:{
            '/CONNECTED_DEVICES/*':{actions: ['*']}
          }
        };

        var testUser = {
          username: 'WEB_SESSION',
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
        };

        var addedTestGroup;
        var addedTestuser;

        var serviceInstance = instance;

        serviceInstance.services.security.users.upsertGroup(testGroup, {overwrite: false}, function (e, result) {

          if (e) return done(e);
          addedTestGroup = result;

          serviceInstance.services.security.users.upsertUser(testUser, {overwrite: false}, function (e, result) {

            if (e) return done(e);
            addedTestuser = result;

            serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser, function (e) {

              if (e) return done(e);

              var newKeypair = crypto.createKeyPair();

              var creds = {

                username: testUser.username,
                publicKey: newKeypair.publicKey,
                privateKey:newKeypair.privateKey

              };

              happn.client.create(creds)

                .then(function (clientInstance) {

                  done(new Error('this was not meant to happn'))

                })

                .catch(function (e) {

                  expect(e.toString()).to.be('Invalid credentials');
                  serviceInstance.stop(done);
                });

            });
          });
        });
      });
    });
  });

  it ('should test the policy ms settings', function(done){

    var SecurityService = require('../lib/services/security/service.js');

    var securityService = new SecurityService({logger: Logger});

    var Utils = require('../lib/services/utils/service.js');

    var utils = new Utils({
      logger:require('happn-logger')
    });

    securityService.happn = {
      services:{
        utils:utils
      }
    };

    securityService.__initializeProfiles(serviceConfig.services.security.config, function(e){

      if (e) return done(e);

      expect(securityService.__cache_Profiles[0].policy.ttl).to.be(4000);
      expect(securityService.__cache_Profiles[0].policy.inactivity_threshold).to.be(2000);
      expect(securityService.__cache_Profiles[1].policy.inactivity_threshold).to.be(60000 * 60 * 48);

      done();

    })

  });

  //require('benchmarket').stop();

});
