describe('e1_pubsub_middleware', function () {

  //require('benchmarket').start();

  //after(require('benchmarket').store());

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

  after('disconnects the client and stops the server', function(callback){

    this.timeout(3000);

    disconnectClient(function(){
      stopService(callback);
    });

  });

  var getService = function(activateSessionManagement, sessionActivityTTL, callback, sessionActivityLogging, port){

    if (!port) port = 55556;

    if (sessionActivityLogging == undefined) sessionActivityLogging = true;

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
                logSessionActivity:sessionActivityLogging,
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

  before('starts up happn instance with session management switched on', function(callback){
    getService(callback);
  });

  xit('tests injecting spy middleware into the pubsub service', function (callback) {

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


  //require('benchmarket').stop();

});
