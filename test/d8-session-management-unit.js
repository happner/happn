describe('d8_session_management', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var async = require('async');

  var SecurityService = require('../lib/services/security/service');
  var CacheService = require('../lib/services/cache/service');
  var DataService = require('../lib/services/data/service');
  var CryptoService = require('../lib/services/crypto/service');
  var PubSubService = require('../lib/services/pubsub/service');

  var Logger = require('happn-logger');

  var mockServices = function(sessionManagementActive, callback){

    if (typeof sessionManagementActive == 'function'){
      callback = sessionManagementActive;
      sessionManagementActive = true;
    }

    var dataService = new DataService({logger: Logger});
    var cacheService = new CacheService({logger: Logger});
    var securityService = new SecurityService({logger: Logger});
    var cryptoService = new CryptoService({logger: Logger});
    var pubsubService = new PubSubService({logger: Logger});

    var happn = {services:{}};

    happn.utils = require('../lib/utils');

    cryptoService.initialize({}, function(e){

      if (e) return callback(e);

      happn.services.crypto = cryptoService;

      dataService.initialize({}, function(e){

        if (e) return callback(e);

        happn.services.data = dataService;

        cacheService.happn = happn;

        cacheService.initialize({}, function(e){

          if (e) return callback(e);

          happn.services.cache = cacheService;

          securityService.happn = happn;

          securityService.dataService = dataService;
          securityService.cacheService = cacheService;
          securityService.cryptoService = cryptoService;

          securityService.initialize({
            activateSessionManagement:sessionManagementActive,
            sessionActivityTTL:3000,
            secure:true
          }, function(e){

            if (e) return callback(e);

            happn.services.security = securityService;

            pubsubService.happn = happn;
            pubsubService.securityService = securityService;
            pubsubService.config = {secure:true};

            pubsubService.securityService.onDataChanged(pubsubService.securityDirectoryChanged.bind(pubsubService));

            happn.services.pubsub = pubsubService;
            callback(null, happn);

          });
        });
      });
    });
  };

  var mockSession = function(type, id, username, ttl){

    if (!ttl) ttl = Infinity;

    return {
      timestamp:Date.now(),
      type:type,
      id:id,
      ttl:ttl,
      user:{
        username:username
      }
    };
  };

  it('tests sessionActivity activation', function (done) {

    mockServices(function(e, happn){

      if (e) return done(e);

      expect(happn.services.security.__sessionManagementActive).to.be(true);

      expect(happn.services.security.__cache_revoked_sessions).to.not.be(null);
      expect(happn.services.security.__cache_session_activity).to.not.be(null);
      expect(happn.services.security.__cache_active_sessions).to.not.be(null);

      done();

    })

  });

  it('tests security services addActiveSession and removeActiveSession', function (done) {

    mockServices(function(e, happn){

      if (e) return done(e);


      var session = mockSession(1, 'TEST567', 'TESTUSER');

      happn.services.security.addActiveSession(session, function(e){

        if (e) return done(e);

        happn.services.security.listActiveSessions(function(e, list){

          if (e) return done(e);

          expect(list[0].username).to.be('TESTUSER');
          expect(list[0].id).to.be('TEST567');

          happn.services.security.removeActiveSession(session, function(){

            if (e) return done(e);

            happn.services.security.listActiveSessions(function(e, list){

              if (e) return done(e);

              expect(list.length).to.be(0);
              done();
            });
          });
        });
      });
    });
  });

  it('tests security services update session activity, list session activity', function (done) {

    this.timeout(10000);

    mockServices(function(e, happn){

      if (e) return done(e);

      async.times(10, function(timeIndex, timeCB){

        var session = mockSession(1, 'TEST_SESSION' + timeIndex, 'TEST_USER' + timeIndex);
        happn.services.security.__logSessionActivity(session, 'testpath'  + timeIndex, 'testaction' + timeIndex, timeCB);
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

        var session = mockSession(1, 'TEST_SESSION' + timeIndex, 'TEST_USER' + timeIndex);
        happn.services.security.__logSessionActivity(session, 'testpath'  + timeIndex, 'testaction' + timeIndex, timeCB);
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

      var session = mockSession(1, 'TEST_SESSION', 'TEST_USER');

      happn.services.security.__logSessionActivity(session, 'testpath1', 'testaction1', function(e){

        if (e) return done(e);

        happn.services.security.__logSessionActivity(session, 'testpath2', 'testaction2', function(e){

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

      var session = mockSession(1, 'TEST_SESSION', 'TEST_USER', 60000);

      happn.services.security.revokeSession(session, function(e){

        if (e) return done(e);

        happn.services.security.listRevokedSessions(function(e, list){

          if (e) return done(e);

          expect(list.length).to.be(1);

          happn.services.security.__checkRevocations('TEST_SESSION', function(e){

            expect(e.toString()).to.be('Error: session with id TEST_SESSION has been revoked');

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

    this.timeout(4000);

    var mockSocket = {

    };

    var session = mockSession(1, 'TEST_SESSION', 'TEST_USER');

    mockServices(function(e, happn) {

      if (e) return done(e);

      happn.services.pubsub.attachSession(mockSocket, session);

      setTimeout(function () {

        happn.services.security.listActiveSessions(function (e, list) {

          if (e) return done(e);

          expect(list.length).to.be(1);

          expect(list[0].username).to.be('TEST_USER');
          expect(list[0].id).to.be('TEST_SESSION');

          happn.services.pubsub.detachSession(mockSocket);

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

    this.timeout(4000);

    var mockSocket = {};

    var session = mockSession(1, 'TEST_SESSION1', 'TEST_USER1');

    mockServices(false, function(e, happn) {

      if (e) return done(e);

      happn.services.pubsub.attachSession(mockSocket, session);

      setTimeout(function () {

        happn.services.security.listActiveSessions(function (e, list) {

          expect(e.toString()).to.be('Error: session management not activated');

          happn.services.security.activateSessionManagement(function(e){

            if (e) return done(e);

            setTimeout(function () {

              happn.services.security.listActiveSessions(function (e, list) {

                if (e)  return done(e);

                expect(list.length).to.be(1);
                expect(list[0].username).to.be('TEST_USER1');
                expect(list[0].id).to.be('TEST_SESSION1');

                done();
              });
            }, 1000);
          });
        });
      }, 1000);
    });
  });

  it('tests session revocation times out', function (done) {

    this.timeout(7000);

    var mockSocket = {};

    var session = mockSession(1, 'TEST_SESSION1', 'TEST_USER1', 3000);

    mockServices(true, function(e, happn) {

      if (e) return done(e);

      happn.services.pubsub.attachSession(mockSocket, session);

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

    this.timeout(7000);

    var mockSocket = {};

    var session = mockSession(1, 'TEST_SESSION1', 'TEST_USER1', 2000);

    mockServices(true, function(e, happn) {

      if (e) return done(e);

      happn.services.pubsub.attachSession(mockSocket, session);

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
