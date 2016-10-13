describe('c4_session_events', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var sessionEventsTest = function (serviceConfig, callback) {

    var eventsFired = {
      "authentic-eventemitter": false,
      "disconnect-eventemitter": false,
      "authentic-socket": false,
      "disconnect-socket": false
    };

    var serviceInstance;
    var stopped = false;

    var checkAllEventsFired = function (cb) {

      for (var eventName in eventsFired) if (!eventsFired[eventName]) return;

      if (!stopped) {
        stopped = true;
        serviceInstance.stop({reconnect: false}, callback);
      }
    };

    service.create(serviceConfig,

      function (e, happnInst) {
        if (e)
          return callback(e);

        serviceInstance = happnInst;

        serviceInstance.services.session.on('authentic', function (data) {

          if (data.info._local) eventsFired['authentic-eventemitter'] = true;
          else eventsFired['authentic-socket'] = true;

          checkAllEventsFired(callback);

        });

        serviceInstance.services.session.on('disconnect', function (data) {

          if (data.info._local) eventsFired['disconnect-eventemitter'] = true;
          else eventsFired['disconnect-socket'] = true;

          checkAllEventsFired(callback);

        });

        var socketClient;
        var eventEmitterClient;

        happn_client.create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          }
        }, function (e, instance) {

          if (e) return callback(e);

          socketClient = instance;

          serviceInstance.services.session.localClient({

            username: '_ADMIN',
            password: 'happn'

          })

          .then(function (clientInstance) {

            eventEmitterClient = clientInstance;

            socketClient.disconnect();
            eventEmitterClient.disconnect();
          })

          .catch(function (e) {
            callback(e);
          });

        });

      });

  }

  it('tests session events on an unsecured mesh', function (callback) {

    sessionEventsTest({}, callback);

  });

  it('tests session events on a secure mesh', function (callback) {

    sessionEventsTest({secure: true}, callback);

  });

  require('benchmarket').stop();

});
