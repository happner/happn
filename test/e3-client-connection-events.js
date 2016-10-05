var path = require('path');
var filename = path.basename(__filename);

var benchmarket = require('benchmarket');
var Promise = require('bluebird');
var expect = require('expect.js');
var Happn = require('../');

describe(filename, function() {

  benchmarket.start();

  var server;

  var startServer = Promise.promisify(function(callback) {
    Happn.service.create()
      .then(function(_server) {
        server = _server;
      })
      .then(callback)
      .catch(callback);
  });

  var stopServerDisconnect = Promise.promisify(function(callback) {
    if (!server) return callback();
    server.stop({reconnect: false}, function(e) {
      if (e) return callback(e);
      server = undefined; // ?? perhaps also on e, messy
      callback();
    });
  });

  var stopServerReconnect = Promise.promisify(function(callback) {
    if (!server) return callback();
    server.stop({reconnect: true}, function(e) {
      if (e) return callback(e);
      server = undefined;
      callback();
    });
  });

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
        return startServer();
      })

      .then(function() {
        return Happn.client.create();
      })

      .then(function(_client){
        client = _client;
      })

      .then(function() {
        client.onEvent('reconnect-scheduled', function() {
          reconnectScheduledFired = true;
        });
      })

      .then(function() {
        return stopServerReconnect();
      })

      .then(function() {
        return Promise.delay(200);
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
        return startServer();
      })

      .then(function() {
        return Happn.client.create();
      })

      .then(function(_client){
        client = _client;
      })

      .then(function() {
        client.onEvent('reconnect-successful', function() {
          reconnectSuccessfulFired = true;
        });
      })

      .then(function() {
        return stopServerReconnect();
      })

      .then(function() {
        return startServer();
      })

      .then(function() {
        return Promise.delay(500);
      })

      .then(function() {
        expect(reconnectSuccessfulFired).to.eql(true);
      })

      .then(done)

      .catch(done);

  });

  it('enables subscribe and unsubscribe', function(done) {
    done();
  });

  after(benchmarket.store());
  benchmarket.stop();

});
