describe('c4_session_events', function() {

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var sessionEventsTest = function(serviceConfig, callback){

    var eventsFired = {
      "authentic-eventemitter":false,
      "disconnect-eventemitter":false,
      "authentic-socket":false,
      "disconnect-socket":false
    }

    var serviceInstance;

    var checkAllEventsFired = function(cb){

      for (var eventName in eventsFired)
        if (!eventsFired[eventName]) return;

      serviceInstance.close(callback);

    }

    service.create(serviceConfig,
      function(e, happnInst){
        if (e)
          return callback(e);

        serviceInstance = happnInst;

        happnInst.services.pubsub.on('authentic', function(data){

          console.log('authentic:::', data);

          eventsFired['authentic'] = true;
          checkAllEventsFired(callback);

        });

        happnInst.services.pubsub.on('disconnect', function(data){

          console.log('disconnect:::', data);

          eventsFired['disconnect'] = true;
          checkAllEventsFired(callback);

        });

        var socketClient;
        var eventEmitterClient;

        happn_client.create({
          config:{
            username:'_ADMIN',
            password:'happn'
          }
        },function(e, instance) {

          if (e) return callback(e);

          socketClient = instance;

          happn.client.create({
            config:{
              username:'_ADMIN',
              password:'happn'
            },
            plugin: happn.client_plugins.intra_process,
            context: happnInst,
            secure:true
          })

          .then(function(clientInstance){
            eventEmitterClient = clientInstance;

            socketClient.disconnect();
            eventEmitterClient.disconnect();

          })

          .catch(function(e){
            callback(e);
          });

        });

    });

  }

  it('tests session events on an unsecured mesh', function(callback) {

    sessionEventsTest({secure:true}, callback);

  });

  // it('tests session events on a secure mesh', function(callback) {

  //   sessionEventsTest({},callback);

  // });

});