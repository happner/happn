
// ?? https://github.com/happner/happner/issues/115

var path = require('path');
var name = path.basename(__filename);
var happn = require('../../lib/index');
var service = happn.service;
var client = happn.client;
var Promise = require('bluebird');

describe(name, function() {

  require('benchmarket').start();
  after(require('benchmarket').store());

  context('with no cache and 20 subscriptions', function() {

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

    // before('start publisher', function(done) {
    //   var _this = this;
    //   client.create({
    //     plugin: happn.client_plugins.intra_process,
    //     context: this.happnServer
    //   }).then(function(client) {
    //     _this.publisher = client;
    //     done();
    //   }).catch(done);
    // });
    //
    // after('stop publisher', function(done) {
    //   if (this.publisher) {
    //     // return this.publisher.stop(done);
    //     // no need client stop(), intraprocess...
    //     //                        stop only disconnectes primus
    //   }
    //   done();
    // });

    before('start subscribers', function(done) {
      var _this = this;
      Promise.resolve(new Array(20)).map(
        function() {
          return client.create({
            plugin: happn.client_plugins.intra_process,
            context: _this.happnServer
          })
        }, {concurrency: 20}
      ).then(function(subscribersArray) {
        _this.subscribers = subscribersArray;
        _this.publisher = subscribersArray[0]; // first subscriber also publisher
        done();
      }).catch(done);
    });

    before('subscribe to event1', function(done) {
      this.events = 0;
      var _this = this;
      Promise.resolve(this.subscribers).map(function(client) {
        return client.on('/some/path/*', function handler(data, meta) {
          _this.events++;
          console.log('handling ' + meta.path + ', seq:' + _this.events);
          if (_this.events === 20000) { // only end test after last handler runs
            _this.endTest();
            delete _this.endTest;
          }
        });
      }).then(function() {
        done();
      }).catch(done);
    });

    it('emits 1000 events', function(done) {
      this.endTest = done;
      for(var i = 0; i < 1000; i++) {
        // if any events go missing (not emitted to subscribers this
        // test will time out because it only emits just enough events
        // to satisfy the required total where/when endTest() is run
        this.publisher.set('/some/path/event' + i % 10, {da: 'ta'});
      }
    });

  });

  context('with no cache and 200 subscriptions', function() {

    it('emits 1000 events');

  });

  require('benchmarket').stop();

});
