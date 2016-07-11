var path = require('path');
var filename = path.basename(__filename);
var happn = require('../lib/index');
var service = happn.service;

describe(filename, function () {

  require('benchmarket').start();
  after(require('benchmarket').store({timeout:10000}));

  beforeEach(function () {
    delete process.env.UPDATE_BROWSER_PRIMUS;
  });

  afterEach(function (done) {
    if (!this.server) return done();
    this.server.stop(done);
  });

  it('update browser_primus script', function (done) {
    // Primus requires dynamic creation of the clientside script,
    // We are putting this dynamically created script into lib/public,
    // so that there is no need to RE-create the client script with each happn startup
    //
    // This test does that update so that when primus in upgraded in package.json
    // the corresponding new browser_primus is also kept up-to-date.
    process.env.UPDATE_BROWSER_PRIMUS = '1';
    var _this = this;
    service.create().then(function (server) {
      _this.server = server;
      done();
    }).catch(done);
  });

  it('default startup time', function (done) {
    var _this = this;
    service.create().then(function (server) {
      _this.server = server;
      done();
    }).catch(done);
  });

  require('benchmarket').stop();

});
