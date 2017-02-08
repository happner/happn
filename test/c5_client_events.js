describe('c5_client_events', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');
  var http = require('http');

  var serviceConfig = {secure: true};
  var serviceInstance;

  this.timeout(20000);

  function createService(callback) {

    service.create(serviceConfig,
      function (e, happnInst) {
        if (e)
          return callback(e);

        serviceInstance = happnInst;
        callback();
      });

  }

  after('it stops the test service', function (done) {
    serviceInstance.stop(done);
  });

  before('start the test service', function (done) {

    createService(done);

  });

  it('logs on with a client and attached to the client side end event, we stop the server and ensure the end event is fired', function (callback) {

    happn.client.create({
      config: {
        username: '_ADMIN',
        password: 'happn'
      }
    })

      .then(function (clientInstance) {

        clientInstance.onEvent('connection-ended', function (opts) {
          createService(callback);
        });

        clientInstance.set('/setting/data/before/end', {test: "data"}, function (e, response) {
          if (e) return callback(e);

          serviceInstance.stop({reconnect: false}, function (e) {
            if (e) return callback(e);
          });

        });

      });

  });

  it('logs on with a client and attached to the client side reconnection events, we destroy the client sockets on the server - check the reconnect events fire, check reconnection happens and we can push data ok', function (callback) {

    var eventsFired = {
      'reconnect-scheduled': false,
      'reconnect-successful': false
    };

    happn.client.create({
      config: {
        username: '_ADMIN',
        password: 'happn'
      }
    })

      .then(function (clientInstance) {

        clientInstance.onEvent('reconnect-scheduled', function (opts) {
          eventsFired['reconnect-scheduled'] = true;
        });

        clientInstance.onEvent('reconnect-successful', function (opts) {
          eventsFired['reconnect-successful'] = true;
        });

        clientInstance.set('/setting/data/before/reconnect', {test: "data"}, function (e, response) {
          if (e) return callback(e);

          for (var key in serviceInstance.connections)
            serviceInstance.connections[key].destroy();

          if (e) return callback(e);

          setTimeout(function () {

            if (e) return callback(e);

            clientInstance.set('/setting/data/after/reconnect', {test: "data"}, function (e, response) {

              if (e) return callback(e);
              if (eventsFired['reconnect-scheduled'] && eventsFired['reconnect-successful']) return callback();
              callback(new Error('reconnection events did not fire'));

            });

          }, 2000);

        });

      });

  });

  it('does not retry after a login has failed', function (callback) {
    this.timeout(100000);

    var eventsFired = {
      'reconnect-scheduled': false,
      'reconnect-successful': false
    };

    var client = (new happn.client()).client({
      config: {
        username: '_ADMIN',
        password: 'bad password',
        port: 55002
      }
    });

    client.initialize(function (e) {
      if (e && e.code == 'ECONNREFUSED') return;
      eventsFired['reconnect-scheduled'] = false;
      setTimeout(function () {
        expect(eventsFired['reconnect-scheduled']).to.eql(false);
        callback();
      }, 5000);
    });

    client.onEvent('reconnect-scheduled', function (opts) {
      eventsFired['reconnect-scheduled'] = true;
    });
  });

  require('benchmarket').stop();

});
