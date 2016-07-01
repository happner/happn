var path = require('path');
var name = path.basename(__filename);
var happn = require('../../lib/index');
var service = happn.service;
var client = happn.client;
var Promise = require('bluebird');
var debug = require('debug')('TEST');

describe(name, function() {

  function createServerAndSubscribers(subscriberCount, loglevel) {

    before('start happn server', function(done) {
      this.timeout(0);
      var _this = this;
      service.create({
        utils: {
          logLevel: loglevel || 'warn'
        }
      }).then(function(server) {
        _this.happnServer = server;
        done();
      }).catch(done);
    });

    after('stop happn server', function(done) {
      this.timeout(0);
      if (this.happnServer) {
        return this.happnServer.stop(done);
      }
      done();
    });

    before('start subscribers', function(done) {
      this.timeout(0);
      var _this = this;
      Promise.resolve(new Array(   subscriberCount   )).map(
        function() {
          return client.create({
            plugin: happn.client_plugins.intra_process,
            context: _this.happnServer
          })
        }
      ).then(function(subscribersArray) {
        _this.subscribers = subscribersArray;
        _this.publisher = subscribersArray[0]; // first subscriber also publisher
        done();
      }).catch(done);
    });
  }

  context('discover', function() {

    createServerAndSubscribers(1, 'info');

    before('subscribe to events', function(done) {
      var _this = this;
      var client = this.subscribers[0];

      // client.onAll(
      //   function handler(data, meta) {
      //     process.nextTick(function() {
      //       debug('XXX -- END TEST -- received emit()');
      //       _this.endTest();
      //     });
      //   },
      //   function ok() {
      //     done();
      //   }
      // );

      // client.on('*', function handler(data, meta) {
      // client.on('/some/path', function handler(data, meta) {
      client.on('/some/*', function handler(data, meta) {
        // client.on('/some/*', {event_type: 'set'}, function handler(data, meta) {
        process.nextTick(function() {
          debug('XXX -- END TEST -- received emit()');
          _this.endTest();
        });
      }).then(function(){
        done();
      }).catch(done);
    });

    it('emits 1 event', function(done) {

      debug('XXX -- START TEST -- calling set()');
      this.endTest = done;
      this.publisher.set('/some/path', {da: 'ta'});

    });

  });

});
