
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
        this.subscribers = subscribersArray;
        this.publisher = subscribersArray[0]; // first subscriber also publisher
        done();
      }).catch(done);
    });

    it('emits 1000 events', function(done) {
      done();
    });

  });

  context('with no cache and 200 subscriptions', function() {

    it('emits 1000 events');

  });

  require('benchmarket').stop();

});
