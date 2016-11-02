var path = require('path');
var filename = path.basename(__filename);

var benchmarket = require('benchmarket');
var Promise = require('bluebird');
var expect = require('expect.js');
var Happn = require('../');

describe(filename, function() {

  benchmarket.start();

  var server;

  var startServer = function(callback) {
    Happn.service.create()
      .then(function(_server) {
        server = _server;
      })
      .then(callback)
      .catch(callback);
  };

  var stopServerDisconnect = function(callback) {
    if (!server) return callback();
    server.stop({reconnect: false}, function(e) {
      if (e) return callback(e);
      server = undefined; // ?? perhaps also on e, messy
      callback();
    });
  };

  var stopServerReconnect = function(callback) {
    if (!server) return callback();
    server.stop({reconnect: true}, function(e) {
      if (e) return callback(e);
      server = undefined;
      callback();
    });
  };

  before('start server', startServer);
  after('stop server', stopServerDisconnect);


  it('emits connection-ended');
  // When? Seems to not occur.
  // Is it supposed to depend on {reconnect: false} on the server? Appears not to.
  // This is a problem for another day,
  // For now 'reconnect-scheduled' and 'connection-ended' mean the same because they
  // both happen on disconnect, the only difference is that the former repeats.


  it('emits reconnect-scheduled', function(done) {
    var client;
    var reconnectScheduledFired = false;

    Promise.resolve()

      .then(function() {
        // other tests may have left the server stopped.
        if (server) return;
        return Promise.promisify(startServer)();
      })

      .then(function() {
        return Happn.client.create();
      })

      .then(function(_client) {
        client = _client;
      })

      .then(function() {
        client.onEvent('reconnect-scheduled', function() {
          reconnectScheduledFired = true;
        });
      })

      .then(function() {
        return Promise.promisify(stopServerReconnect)();
      })

      .then(function() {
        return Promise.delay(500);
      })

      .then(function() {
        expect(reconnectScheduledFired).to.eql(true);
      })

      .then(done)

      .catch(done)
  });


  it('emits reconnect-successful', function(done) {
    var client;
    var reconnectSuccessfulFired = false;


    Promise.resolve()

      .then(function() {
        // other tests may have left the server stopped.
        if (server) return;
        return Promise.promisify(startServer)();
      })

      .then(function() {
        return Happn.client.create();
      })

      .then(function(_client) {
        client = _client;
      })

      .then(function() {
        client.onEvent('reconnect-successful', function() {
          reconnectSuccessfulFired = true;
        });
      })

      .then(function() {
        return Promise.promisify(stopServerReconnect)();
      })

      .then(function() {
        return Promise.promisify(startServer)();
      })

      .then(function() {
        return Promise.delay(1000);
      })

      .then(function() {
        expect(reconnectSuccessfulFired).to.eql(true);
      })

      .then(done)

      .catch(done);

  });

  it('enables subscribe and unsubscribe', function(done) {
    var client;
    var events = {};
    var expectedEvents;

    Promise.resolve()

      .then(function() {
        // other tests may have left the server stopped.
        if (server) return;
        return Promise.promisify(startServer)();
      })

      .then(function() {
        return Happn.client.create();
      })

      .then(function(_client) {
        client = _client;
      })

      .then(function() {
        var subscriptionId = client.onEvent('reconnect-successful', function() {});
        // expect(subscriptionId).to.equal('reconnect-successful|0');
        expect(typeof subscriptionId).to.equal('string');
      })

      .then(function() {
        var subscription1 = client.onEvent('reconnect-scheduled', function() {
          events[1] = true;
        });
        var subscription2 = client.onEvent('reconnect-scheduled', function() {
          events[2] = true;
        });
        var subscription3 = client.onEvent('reconnect-scheduled', function() {
          events[3] = true;
        });
        var subscription4 = client.onEvent('reconnect-scheduled', function() {
          events[4] = true;
        });

        client.offEvent(subscription2);
        client.offEvent(subscription3);
        expectedEvents = {
          1: true,
          4: true
        }
      })

      .then(function() {
        return Promise.promisify(stopServerReconnect)();
      })

      .then(function() {
        return Promise.delay(500);
      })

      .then(function() {
        expect(events).to.eql(expectedEvents);
      })

      .then(done)

      .catch(done);

  });

  after(benchmarket.store());
  benchmarket.stop();

});
