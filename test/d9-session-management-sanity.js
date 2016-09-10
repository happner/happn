describe('d9_session_management_sanity', function () {

  require('benchmarket').start();

  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var serviceInstance;
  var clientInstance;

  var disconnectClient = function(callback){
    if (clientInstance)
      clientInstance.disconnect(callback);
    else
      callback();
  };

  var stopService = function(callback){
    if (serviceInstance)
      serviceInstance.stop(callback);
    else
      callback();
  };

  var getService = function(activateSessionManagement, sessionActivityTTL, callback){

    if (typeof activateSessionManagement == 'function'){

      callback = activateSessionManagement;
      activateSessionManagement = true;
      sessionActivityTTL = 60000 * 60 * 24 * 30;
    }

    disconnectClient(function(e){

      if (e) return callback(e);

      stopService(function(e){

        if (e) return callback(e);

        var serviceConfig = {
          secure: true,
          port:55556,
          services:{
            security:{
              config:{
                activateSessionManagement:activateSessionManagement,
                logSessionActivity:true,
                sessionActivityTTL:sessionActivityTTL
              }
            }
          }
        };

        service.create(serviceConfig,
          function (e, happnInst) {
            if (e)
              return callback(e);

            serviceInstance = happnInst;

            happn_client.create({
              config: {
                port:55556,
                username: '_ADMIN',
                password: 'happn'
              },
              info:{
                from:'startup'
              }
            }, function (e, instance) {

              if (e) return callback(e);

              clientInstance = instance;

              callback();

            });
          }
        );
      });
    });
  };

  before('starts up happn instance with session management switched on', function(callback){
    getService(callback);
  });

  it('tests active sessions and session activity logging on a secure instance', function (callback) {

    this.timeout(6000);

    var RandomActivityGenerator = require("happn-random-activity-generator");

    var randomActivity1 = new RandomActivityGenerator(clientInstance);

    randomActivity1.generateActivityStart("test", function () {

      setTimeout(function () {
        randomActivity1.generateActivityEnd("test", function (aggregatedLog) {

          serviceInstance.services.security.listActiveSessions(function(e, list){

            if (e) return callback(e);
            expect(list.length).to.be(1);

            serviceInstance.services.security.listSessionActivity(function(e, list){

              if (e) return callback(e);
              expect(list.length).to.be(1);

              callback();

            });
          });
        });
      }, 3000);
    });
  });

  it('tests session revocation on a secure instance', function (callback) {

    this.timeout(10000);

    var RandomActivityGenerator = require("happn-random-activity-generator");

    var randomActivity1 = new RandomActivityGenerator(clientInstance);

    randomActivity1.generateActivityStart("test", function () {

      setTimeout(function () {

        randomActivity1.generateActivityEnd("test", function (aggregatedLog) {

          serviceInstance.services.security.listActiveSessions(function(e, list){

            if (e) return callback(e);
            expect(list.length).to.be(1);

            var session = list[0];

            serviceInstance.services.security.listSessionActivity(function(e, list){

              if (e) return callback(e);
              expect(list.length).to.be(1);

              serviceInstance.services.security.revokeSession(session, 'APP', function(e){

                if (e) return callback(e);

                serviceInstance.services.security.listRevokedSessions(function(e, items){

                  if (e) return callback(e);

                  expect(items.length).to.be(1);

                  clientInstance.set('/TEST/DATA', {}, function(e, result){

                    expect(e.toString()).to.be('Error: session with id ' + session.id + ' has been revoked');

                    serviceInstance.services.security.restoreSession(session, function(e){

                      if (e) return callback(e);
                      clientInstance.set('/TEST/DATA', {}, callback);
                    });
                  });
                });
              });
            });
          });
        });
      }, 5000);
    });
  });

  it('tests session management, multiple clients', function (callback) {

    var times = 4;

    this.timeout(times * 6000 + 10000);

    var session_results = [];

    getService(function(e){

      async.timesSeries(times, function(timeIndex, timeCB){

        happn_client.create({
          config: {
            port:55556,
            username: '_ADMIN',
            password: 'happn'
          }
        }, function (e, instance) {

          if (e) return callback(e);

          var sessionData = {};

          sessionData.client = instance;

          var RandomActivityGenerator = require("happn-random-activity-generator");
          var randomActivity = new RandomActivityGenerator(instance);

          sessionData.random = randomActivity;

          randomActivity.generateActivityStart("test", function () {

            setTimeout(function(){

              randomActivity.generateActivityEnd("test", function (aggregatedLog) {

                sessionData.results = aggregatedLog;
                sessionData.client = instance;

                console.log('collected data:::', aggregatedLog);

                session_results.push(sessionData);

                timeCB();

              });
            }, 2500);
          });
        });

      }, function(e){

        if (e) return callback(e);

        setTimeout(function(){

          serviceInstance.services.security.listActiveSessions(function(e, list){

            if (e) return callback(e);

            expect(list.length).to.be(times + 1);//+1 for connected client

            serviceInstance.services.security.listSessionActivity(function(e, list){

              if (e) return callback(e);

              expect(list.length).to.be(times);

              callback();

            });
          });

        }, 4000);
      });
    });
  });

  xit('tests session management, switching on session management with activity logging', function (callback) {

  });

  xit('tests session management, switching on session management without activity logging', function (callback) {

  });

  require('benchmarket').stop();

});
