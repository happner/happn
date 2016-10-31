describe('d8_session_management', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  this.timeout(60000);

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var async = require('async');
  var Promise = require('bluebird');

  var Logger = require('happn-logger');

  var Services = {};

  Services.SecurityService = require('../lib/services/security/service');
  Services.CacheService = require('../lib/services/cache/service');
  Services.DataService = require('../lib/services/data/service');
  Services.CryptoService = require('../lib/services/crypto/service');
  Services.ProtocolService = require('../lib/services/protocol/service');
  Services.PubSubService = require('../lib/services/pubsub/service');
  Services.UtilsService = require('../lib/services/utils/service');
  Services.SessionService = require('../lib/services/session/service');
  Services.SystemService = require('../lib/services/system/service');
  Services.ErrorService = require('../lib/services/error/service');
  Services.QueueService = require('../lib/services/queue/service');
  Services.LayerService = require('../lib/services/layer/service');
  Services.LogService = require('../lib/services/log/service');

  var mockService = Promise.promisify(function(happn, serviceName, config, callback){

    if (typeof config === 'function') {
      callback = config;
      if (config !== false) config = {};
    }

    try{

      var serviceClass = Services[serviceName + 'Service'];

      var serviceInstance = new serviceClass({logger:Logger});

      serviceInstance.happn = happn;

      serviceInstance.config = config;

      happn.services[serviceName.toLowerCase()] = serviceInstance;

      if (typeof serviceInstance.initialize != 'function' || config === false) return callback();

      serviceInstance.initialize(config, callback);

    }catch(e){
      callback(e);
    }

  });

  var mockServices = function(sessionManagementActive, callback){

    var happn = {services:{}, config:{}};

    if (typeof sessionManagementActive == 'function'){
      callback = sessionManagementActive;
      sessionManagementActive = true;
    }

    mockService(happn, 'Crypto')
      .then(mockService(happn, 'Utils'))
      .then(mockService(happn, 'Log'))
      .then(mockService(happn, 'Error'))
      .then(mockService(happn, 'Protocol'))
      .then(mockService(happn, 'Queue'))
      .then(mockService(happn, 'Data'))
      .then(mockService(happn, 'Cache'))
      .then(mockService(happn, 'System'))
      .then(mockService(happn, 'Session', false))
      .then(mockService(happn, 'Security', {
        activateSessionManagement:sessionManagementActive,
        logSessionActivity:true,
        sessionActivityTTL:3000,
        secure:true
      }))
      .then(mockService(happn, 'PubSub', {secure:true}))
      .then(mockService(happn, 'Layer'))
      .then(function(){
        setTimeout(function(){

          happn.services.session.initializeCaches.bind(happn.services.session)(function(e){
            if (e) return callback(e);
            callback(null, happn);
          });
        }, 5000)

      })
      .catch(callback)
  };

  var mockClient = function(){
    return {
      on:function(evt, handler){},
      end:function(data, options){}
    }
  };

  var mockSession = function(type, id, username, ttl, securityService){

    if (!ttl) ttl = Infinity;

    var session = {
      timestamp:Date.now(),
      type:type,
      id:id,
      ttl:ttl,
      user:{
        username:username
      },
      policy:{
        0:{ttl:ttl},
        1:{ttl:ttl}
      }
    };

    session.token = securityService.generateToken(session);

    return session;
  };

  it('tests sessionActivity activation', function (done) {

    mockServices(function(e, happn){

      if (e) return done(e);

      expect(happn.services.security.__sessionManagementActive).to.be(true);
      expect(happn.services.security.__cache_revoked_sessions).to.not.be(null);
      expect(happn.services.security.__cache_session_activity).to.not.be(null);

      done();

    })

  });

  it('tests security services listActiveSessions', function (done) {

    mockServices(function(e, happn){

      if (e) return done(e);

      var client = mockClient();

      happn.services.session.onConnect(client);

      //type, id, username, ttl, securityService

      var session = mockSession(1, client.sessionId, 'TESTUSER', null, happn.services.security);

      happn.services.session.attachSession(session.id, session);

      if (e) return done(e);

      happn.services.security.listActiveSessions(function(e, list){

        if (e) return done(e);

        expect(list[0].user.username).to.be('TESTUSER');
        expect(list[0].id).to.be(client.sessionId);

        done();
      });
    });
  });

  it('tests security services update session activity, list session activity', function (done) {

    mockServices(function(e, happn){

      if (e) return done(e);

      async.times(10, function(timeIndex, timeCB){

        var session = mockSession(1, 'TEST_SESSION' + timeIndex, 'TEST_USER' + timeIndex, null, happn.services.security);
        happn.services.security.__logSessionActivity(session.id, 'testpath'  + timeIndex, 'testaction' + timeIndex, null, true, null, timeCB);

      }, function(e){

        if (e) return done(e);

        happn.services.security.listSessionActivity(function(e, items){

          if (e) return done(e);

          expect(items.length).to.be(10);

          setTimeout(function(){

            happn.services.security.listSessionActivity(function(e, items) {

              if (e) return done(e);

              expect(items.length).to.be(0);

              done();

            });

          }, 7000);
        });
      });
    });
  });

  it('tests security services list session activity, with a filter', function (done) {

    this.timeout(10000);

    mockServices(function(e, happn){

      if (e) return done(e);

      async.times(10, function(timeIndex, timeCB){

        var session = mockSession(1, 'TEST_SESSION' + timeIndex, 'TEST_USER' + timeIndex, null, happn.services.security);
        happn.services.security.__logSessionActivity(session.id, 'testpath'  + timeIndex, 'testaction' + timeIndex, null, true, null, timeCB);
      }, function(e){

        if (e) return done(e);

        happn.services.security.listSessionActivity({action:{$in:['testaction8','testaction9']}}, function(e, items){

          if (e) return done(e);

          expect(items.length).to.be(2);

          done();
        });
      });
    });
  });

  it('tests security services session activity no duplicates', function (done) {

    mockServices(function(e, happn) {

      if (e) return done(e);

      var session = mockSession(1, 'TEST_SESSION', 'TEST_USER', null, happn.services.security);

      happn.services.security.__logSessionActivity(session.id, 'testpath1', 'testaction1', null, true, null, function(e){

        if (e) return done(e);

        happn.services.security.__logSessionActivity(session.id, 'testpath2', 'testaction2', null, true, null, function(e){

          if (e) return done(e);

          happn.services.security.listSessionActivity(function(e, items) {

            if (e) return done(e);

            expect(items.length).to.be(1);

            done();

          });
        });
      });
    });
  });

  it('tests security services session revocation', function (done) {

    mockServices(function(e, happn) {

      if (e) return done(e);

      var session = mockSession(1, 'TEST_SESSION', 'TEST_USER', 60000, happn.services.security);

      happn.services.security.revokeSession(session, function(e){

        if (e) return done(e);

        happn.services.security.listRevokedSessions(function(e, list){

          if (e) return done(e);

          expect(list.length).to.be(1);

          happn.services.security.__checkRevocations('TEST_SESSION', function(e, authorized, reason){

            expect(authorized).to.be(false);
            expect(reason).to.be('session with id TEST_SESSION has been revoked');

            happn.services.security.restoreSession('TEST_SESSION', function(e){

              if (e) return done(e);

              happn.services.security.listRevokedSessions(function(e, list) {

                if (e) return done(e);

                expect(list.length).to.be(0);

                happn.services.security.__checkRevocations('TEST_SESSION', done);
              });
            });
          });
        });
      });
    });
  });

  it('tests pubsub services session logging', function (done) {

    var mockSocket = {

    };

    mockServices(function(e, happn) {

      if (e) return done(e);

      var client = mockClient();

      happn.services.session.onConnect(client);

      //type, id, username, ttl, securityService

      var session = mockSession(1, client.sessionId, 'TEST_USER', null, happn.services.security);

      happn.services.session.attachSession(session.id, session);

      setTimeout(function () {

        happn.services.security.listActiveSessions(function (e, list) {

          if (e) return done(e);

          expect(list.length).to.be(1);

          expect(list[0].user.username).to.be('TEST_USER');
          expect(list[0].id).to.be(client.sessionId);

          happn.services.session.disconnectSession(client.sessionId, 'server disconnect');

          setTimeout(function () {

            happn.services.security.listActiveSessions(function (e, list) {

              if (e) return done(e);
              expect(list.length).to.be(0);

              done();
            });

          }, 1000);
        });
      }, 1000);
    });
  });

  it('tests pubsub services session logging switched on', function (done) {

    var mockSocket = {};

    mockServices(false, function(e, happn) {

      var client = mockClient();

      happn.services.session.onConnect(client);

      //type, id, username, ttl, securityService

      var session = mockSession(1, client.sessionId, 'TEST_USER1', null, happn.services.security);

      happn.services.session.attachSession(session.id, session);

      setTimeout(function () {

        happn.services.security.listActiveSessions(function (e, list) {

          expect(e.toString()).to.be('Error: session management not activated');

          happn.services.security.activateSessionManagement(true, function(e){

            if (e) return done(e);

            setTimeout(function () {

              happn.services.security.listActiveSessions(function (e, list) {

                if (e)  return done(e);

                expect(list.length).to.be(1);
                expect(list[0].user.username).to.be('TEST_USER1');
                expect(list[0].id).to.be(client.sessionId);

                done();
              });
            }, 1000);
          });
        });
      }, 1000);
    });
  });

  it('tests session revocation times out', function (done) {

    var mockSocket = {};

    mockServices(true, function(e, happn) {

      var client = mockClient();

      happn.services.session.onConnect(client);

      var session = mockSession(1, client.sessionId, 'TEST_USER1', 1500, happn.services.security);

      happn.services.session.attachSession(session.id, session);

      setTimeout(function () {

        happn.services.security.revokeSession(session, function(e){

          if (e) return done(e);

          happn.services.security.listRevokedSessions(function(e, list) {

            if (e) return done(e);

            expect(list.length).to.be(1);

            setTimeout(function () {

              happn.services.security.listRevokedSessions(function(e, list) {

                if (e) return done(e);
                expect(list.length).to.be(0);

                done();
              });
            }, 5000);
          });
        });
      }, 1000);
    });
  });

  it('tests session revocation times out after restart', function (done) {


    var mockSocket = {};

    mockServices(true, function(e, happn) {

      var client = mockClient();

      happn.services.session.onConnect(client);

      var session = mockSession(1, client.sessionId, 'TEST_USER1', 1000, happn.services.security);

      happn.services.session.attachSession(session.id, session);

      setTimeout(function () {

        happn.services.security.revokeSession(session, function(e){

          if (e) return done(e);

          happn.services.security.listRevokedSessions(function(e, list) {

            if (e) return done(e);

            expect(list.length).to.be(1);

            expect(Object.keys(happn.services.security.__cache_revoked_sessions.__cache).length).to.be(1);

            happn.services.security.__cache_revoked_sessions.__cache = {};

            expect(Object.keys(happn.services.security.__cache_revoked_sessions.__cache).length).to.be(0);

            delete happn.services.cache.__caches['cache_revoked_sessions'];
            delete happn.services.security.__cache_revoked_sessions;

            happn.services.security.__loadRevokedSessions(function(e) {

              if (e) return done(e);

              expect(Object.keys(happn.services.security.__cache_revoked_sessions.__cache).length).to.be(1);
              happn.services.security.__cache_revoked_sessions.__cache = {};
              expect(Object.keys(happn.services.security.__cache_revoked_sessions.__cache).length).to.be(0);

              setTimeout(function () {

                delete happn.services.cache.__caches['cache_revoked_sessions'];

                happn.services.security.__loadRevokedSessions(function(e) {

                  if (e) return done(e);
                  expect(Object.keys(happn.services.security.__cache_revoked_sessions.__cache).length).to.be(0);

                  done();
                });
              }, 5000);
            });
          });
        });
      }, 1000);
    });
  });

  require('benchmarket').stop();
});
