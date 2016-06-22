
// ?? https://github.com/happner/happner/issues/115

var path = require('path');
var name = path.basename(__filename);
var happn = require('../../lib/index');
var service = happn.service;

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

    it('emits 1000 events', function(done) {
      done();
    });

  });

  context('with no cache and 200 subscriptions', function() {

    it('emits 1000 events');

  });

  require('benchmarket').stop();

});
