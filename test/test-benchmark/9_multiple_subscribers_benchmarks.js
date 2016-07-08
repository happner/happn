// ?? https://github.com/happner/happner/issues/115

var path = require('path');
var name = path.basename(__filename);
var happn = require('../../lib/index');
var service = happn.service;
var client = happn.client;
var Promise = require('bluebird');
var debug = require('debug')('TEST');

describe(name, function () {

  function createServerAndSubscribers(subscriberCount, loglevel) {

    before('start happn server', function (done) {
      this.timeout(0);
      var _this = this;
      service.create({
        utils: {
          logLevel: loglevel || 'warn'
        }
      }).then(function (server) {
        _this.happnServer = server;
        done();
      }).catch(done);
    });

    after('stop happn server', function (done) {
      this.timeout(0);
      if (this.happnServer) {
        return this.happnServer.stop(done);
      }
      done();
    });

    before('start subscribers', function (done) {
      this.timeout(0);
      var _this = this;
      Promise.resolve(new Array(subscriberCount)).map(
        function () {
          return client.create({
            plugin: happn.client_plugins.intra_process,
            context: _this.happnServer
          })
        }
      ).then(function (subscribersArray) {
        _this.subscribers = subscribersArray;
        _this.publisher = subscribersArray[0]; // first subscriber also publisher
        done();
      }).catch(done);
    });
  }

  function testMultipleSameWildcardSubscribers(subscriberCount, eventCount, emitCount) {

    // subscriberCount - how many subscribers to to include in test
    //                   all subscribing to the same wildcard path
    // eventCount - how man different events to send (event0, event1, event2)
    // emitCount - total events to send as the test

    createServerAndSubscribers(subscriberCount, 'warn');

    before('subscribe to events', function (done) {
      this.timeout(0);
      var events = 0;
      var endAt = subscriberCount * emitCount;
      var _this = this;
      Promise.resolve(this.subscribers).map(function (client) {
        return client.on('/some/path/*', function handler(data, meta) {
          events++;
          // console.log('handling ' + meta.path + ', seq:' + events);
          if (events === endAt) { // only end test after last handler runs
            _this.endTest();
            delete _this.endTest;
          }
        });
      }).then(function () {
        done();
      }).catch(done);
    });

    it('emits ' + emitCount + ' events', function (done) {
      this.timeout(0);
      this.endTest = done;
      for (var i = 0; i < emitCount; i++) {
        // if any events go missing (not emitted to subscribers this
        // test go on forever because it only emits just enough events
        // to satisfy the required total (endAt) where/when endTest() is run
        this.publisher.set('/some/path/event' + i % eventCount, {da: 'ta'});
      }
    });

  }


  function testMultipleDifferentWildcardSubscribersRepeating(subscriberCount, eventCount, emitCount) {

    // subscriberCount - how many subscribers to to include in test
    //                   all subscribing to different wildcard paths
    // eventCount - how man different events to send (event0, event1, event2)
    // emitCount - total events to send as the test where the emitted paths repeat

    createServerAndSubscribers(subscriberCount);

  }

  function testMultipleDifferentWildcardSubscribersNotRepeating(subscriberCount, eventCount, emitCount) {

    // subscriberCount - how many subscribers to to include in test
    //                   all subscribing to different wildcard paths
    // eventCount - how man different events to send (event0, event1, event2)
    // emitCount - total events to send as the test where the emitted paths do not repeat

    createServerAndSubscribers(subscriberCount);

  }


  function testMultipleSeparateSubscribersOneEmit(subscriberCount, eventCount) {

    // many separate subscriptions on different paths
    // emit to only one of them

    // subscriberCount - how many subscribers to to include in test
    // eventCount - how many different events to subscribe to

    createServerAndSubscribers(subscriberCount);

    before('subscribe to events', function (done) {
      this.timeout(0);
      var events = 0;
      var endAt = 1;
      var _this = this;
      Promise.resolve(new Array(eventCount)).map(function (__, i) {
        var path = '/some/path/' + i;
        var client = _this.subscribers[i % subscriberCount];
        return client.on(path, function handler(data, meta) {
          events++;
          // console.log('handling ' + meta.path + ', seq:' + events);
          if (events === endAt) { // only end test after last handler runs
            process.nextTick(function () {
              debug('XXX -- END TEST -- received emit()');
              _this.happnServer.log.info('XXX -- END TEST -- received emit()');
              _this.endTest();
              delete _this.endTest;
            });
          }
        });
      }).then(function () {
        done();
      }).catch(done);
    });

    it('emits ' + 1 + ' event', function (done) {
      this.timeout(0);
      debug('XXX -- START TEST -- calling set()');
      this.happnServer.log.info('XXX -- START TEST -- calling set()');
      this.timeout(subscriberCount * emitCount / 10);
      this.endTest = done;
      this.publisher.set('/some/path/0', {da: 'ta'});
      // this.publisher.set('/some/path/0', {da: 'ta'}, {noStore: true});
    });

  }

  // require('benchmarket').start();
  // after(require('benchmarket').store());

  xcontext('with no cache and 20 same wildcard subscribers', function () {

    subscriberCount = 20;
    eventCount = 10;
    emitCount = 1000;

    testMultipleSameWildcardSubscribers(subscriberCount, eventCount, emitCount);

  });

  xcontext('with no cache and 200 same wildcard subscribers', function () {

    subscriberCount = 200;
    eventCount = 10;
    emitCount = 1000;

    testMultipleSameWildcardSubscribers(subscriberCount, eventCount, emitCount);

  });

  xcontext('with no cache and 20 different wildcard subscribers repeating', function () {

    subscriberCount = 20;
    eventCount = 10;
    emitCount = 1000;

    testMultipleDifferentWildcardSubscribersRepeating(subscriberCount, eventCount, emitCount);

  });

  xcontext('with no cache and 200 different wildcard subscribers repeating', function () {

    subscriberCount = 200;
    eventCount = 10;
    emitCount = 1000;

    testMultipleDifferentWildcardSubscribersRepeating(subscriberCount, eventCount, emitCount);

  });

  xcontext('with no cache and 20 different wildcard subscribers not repeating', function () {

    subscriberCount = 20;
    eventCount = 10;
    emitCount = 1000;

    testMultipleDifferentWildcardSubscribersNotRepeating(subscriberCount, eventCount, emitCount);

  });

  xcontext('with no cache and 200 different wildcard subscribers not repeating', function () {

    subscriberCount = 200;
    eventCount = 10;
    emitCount = 1000;

    testMultipleDifferentWildcardSubscribersNotRepeating(subscriberCount, eventCount, emitCount);

  });

  xcontext('with no cache and 1 separate subscribers on 20 separate events', function () {

    subscriberCount = 1;
    eventCount = 20;

    testMultipleSeparateSubscribersOneEmit(subscriberCount, eventCount);

  });

  xcontext('with no cache and 1 separate subscribers on 200 separate events', function () {

    subscriberCount = 1;
    eventCount = 200;

    testMultipleSeparateSubscribersOneEmit(subscriberCount, eventCount);

  });

  xcontext('with no cache and 1 separate subscribers on 2000 separate events', function () {

    subscriberCount = 1;
    eventCount = 2000;

    testMultipleSeparateSubscribersOneEmit(subscriberCount, eventCount);

  });

  xcontext('with no cache and 20 separate subscribers on 20 separate events', function () {

    subscriberCount = 20;
    eventCount = 20;

    testMultipleSeparateSubscribersOneEmit(subscriberCount, eventCount);

  });

  xcontext('with no cache and 200 separate subscribers on 200 separate events', function () {

    subscriberCount = 200;
    eventCount = 200;

    testMultipleSeparateSubscribersOneEmit(subscriberCount, eventCount);

  });

  xcontext('with no cache and 2000 separate subscribers on 2000 separate events', function () {

    subscriberCount = 2000;
    eventCount = 2000;

    testMultipleSeparateSubscribersOneEmit(subscriberCount, eventCount);

  });

  // require('benchmarket').stop();

  context('discover', function () {

    createServerAndSubscribers(1, 'info');

    before('subscribe to events', function (done) {
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
        process.nextTick(function () {
          debug('XXX -- END TEST -- received emit()');
          _this.endTest();
        });
      }).then(function () {
        done();
      }).catch(done);
    });

    it('emits 1 event', function (done) {

      debug('XXX -- START TEST -- calling set()');
      this.endTest = done;
      this.publisher.set('/some/path', {da: 'ta'});

    });

  });

});
