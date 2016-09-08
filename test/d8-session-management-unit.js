describe('d8_session_management', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var serviceInstance;
  var clientInstance;

  var SecurityService = require('../lib/services/security/service');
  var CacheService = require('../lib/services/cache/service');
  var DataService = require('../lib/services/data/service');
  var CryptoService = require('../lib/services/crypto/service');

  var Logger = require('happn-logger');

  var mockServices = function(callback){

    var dataService = new DataService({logger: Logger});
    var cacheService = new CacheService({logger: Logger});
    var securityService = new SecurityService({logger: Logger});
    var cryptoService = new CryptoService({logger: Logger});

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
            activateSessionManagement:true,
            sessionActivityTTL:3000
          }, function(e){

            if (e) return callback(e);

            happn.services.security = securityService;

            callback(null, happn);

          });

        });

      });

    });

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

  var mockSession = function(type, id, username){
    return {
      timestamp:Date.now(),
      type:type,
      id:id,
      user:{
        username:username
      }
    };
  };

  it('tests security services addActiveSession and removeActiveSession', function (done) {

    mockServices(function(e, happn){

      if (e) return done(e);


      var session = mockSession(1, 'TEST567', 'TESTUSER');

      happn.services.security.addActiveSession(session, function(e){

        if (e) return done(e);

        happn.services.security.listActiveSessions(function(e, list){

          if (e) return done(e);

          expect(list[0].data.username).to.be('TESTUSER');
          expect(list[0].key).to.be('TEST567');

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

  xit('tests security services addActiveSession and removeActiveSession no duplicates', function (done) {

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


  require('benchmarket').stop();

});
