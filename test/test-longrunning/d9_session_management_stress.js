describe('d9_session_management_sanity', function () {

  require('benchmarket').start();

  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../../lib/index')
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
      serviceInstance.stop(callback)
    else
      callback();
  };

  var getService = function(activateSessionManagement, sessionActivityTTL, callback, port){

    if (!port) port = 55556;

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
          port:port,
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
                port:port,
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

  it('tests session management, multiple clients in series', function (callback) {

    var times = 20;

    this.timeout(times * 6000 + 10000);

    var session_results = [];

    getService(true, 500000, function(e){

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
            }, 1500);
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

        }, 10000);
      });
    });
  });

  it('tests session management, multiple clients in parallel', function (callback) {

    var times = 20;

    this.timeout(times * 6000 + 10000);

    var session_results = [];

    getService(true, 500000, function(e){

      async.times(times, function(timeIndex, timeCB){

        happn_client.create({
          config: {
            port:55557,
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

                console.log('collected data:::', timeIndex + 1);

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

            console.log('active sessions:::',list.length);

            expect(list.length).to.be(times + 1);//+1 for connected client

            serviceInstance.services.security.listSessionActivity(function(e, list){

              if (e) return callback(e);

              console.log('sessions activity:::',list.length);

              expect(list.length).to.be(times);

              callback();
            });
          });
        }, 10000);
      });
    }, 55557);

  });

  require('benchmarket').stop();

});
