
// ?? https://github.com/happner/happner/issues/115

var path = require('path');
var name = path.basename(__filename);
var happn = require('../../lib/index');
var service = happn.service;
var client = happn.client;
var Promise = require('bluebird');

describe(name, function() {

  function testMultipleSubscribers(subscriberCount, eventCount, emitCount) {

    // subscriberCount - how many subscribers to to include in test
    // eventCount - how man different events to send (event0, event1, event2)
    // emitCount - total events to send as the test

    before('start happn server', function(done) {
      var _this = this;
      service.create().then(function(server) {
        _this.happnServer = server;
        done();
      }).catch(done);
    });

    after('stop happn server', function(done) {
      if (this.happnServer) {
        return this.happnServer.stop(done);
      }
      done();
    });

    before('start subscribers', function(done) {
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

    before('subscribe to events', function(done) {
      var events = 0;
      var endAt = subscriberCount * emitCount;
      var _this = this;
      Promise.resolve(this.subscribers).map(function(client) {
        return client.on('/some/path/*', function handler(data, meta) {
          events++;
          // console.log('handling ' + meta.path + ', seq:' + events);
          if (events === endAt) { // only end test after last handler runs
            _this.endTest();
            delete _this.endTest;
          }
        });
      }).then(function() {
        done();
      }).catch(done);
    });

    it('emits ' + emitCount + ' events', function(done) {
      this.timeout(subscriberCount * emitCount / 10);
      this.endTest = done;
      for(var i = 0; i < emitCount; i++) {
        // if any events go missing (not emitted to subscribers this
        // test will time out because it only emits just enough events
        // to satisfy the required total where/when endTest() is run
        this.publisher.set('/some/path/event' + i % eventCount, {da: 'ta'});
      }
    });

  }

  require('benchmarket').start();
  after(require('benchmarket').store());

  context('with no cache and 20 subscribers', function() {

    subscriberCount = 20;
    eventCount = 10;
    emitCount = 1000;

    testMultipleSubscribers(subscriberCount, eventCount, emitCount)

  });

  context('with no cache and 200 subscribers', function() {

    subscriberCount = 200;
    eventCount = 10;
    emitCount = 1000;

    testMultipleSubscribers(subscriberCount, eventCount, emitCount)

  });

  require('benchmarket').stop();

});
