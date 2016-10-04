var path = require('path');
var filename = path.basename(__filename);

var benchmarket = require('benchmarket');
var Promise = require('bluebird');
var expect = require('expect.js');
var Happn = require('../');

describe(filename, function() {

  benchmarket.start();

  var server;

  function startServer(callback) {
    Happn.service.create()
      .then(function(_server) {
        server = _server;
      })
      .then(callback)
      .catch(callback);
  }

  function stopServerDisconnect(callback) {
    if (!server) return callback();
    server.stop({reconnect: false}, function(e) {
      if (e) return callback(e);
      server = undefined; // ?? perhaps also on e, messy
      callback();
    });
  }

  function stopServerReconnect(callback) {
    if (!server) return callback();
    server.stop({reconnect: true}, function(e) {
      if (e) return callback(e);
      server = undefined;
      callback();
    });
  }

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
    var reconnectFired = false;

    Promise.resolve()

      .then(function() {
        if (server) return;
        // other tests may have left the server stopped.
        return Promise.promisify(startServer)();
      })

      .then(function() {
        return Happn.client.create();
      })

      .then(function(_client){
        client = _client;
      })

      .then(function() {
        client.onEvent('reconnect-scheduled', function() {
          reconnectFired = true;
        });
      })

      .then(function() {
        return Promise.promisify(stopServerReconnect)();
      })

      .then(function() {
        return Promise.delay(200);
      })

      .then(function() {
        expect(reconnectFired).to.eql(true);
      })

      .then(done)

      .catch(done)
  });


  it('emits reconnect-successful', function(done) {
    done();
  });

  it('enables subscribe and unsubscribe', function(done) {
    done();
  });

  after(benchmarket.store());
  benchmarket.stop();

});
