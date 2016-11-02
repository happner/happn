var path = require('path');
var filename = path.basename(__filename);
var happn = require('../lib/index');
var service = happn.service;
var happnInstance;

describe(filename, function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store({timeout:10000}));

  before('should initialize the service', function (callback) {

    test_id = Date.now() + '_' + require('shortid').generate();

    try {
      service.create({},
        function (e, happnInst) {

          if (e) return callback(e);

          happnInstance = happnInst;
          callback();
        });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {
    happnInstance.stop(done);
  });

  it('runs stats after the server has started', function (done) {

    var stats = happnInstance.services.stats.fetch();

    console.log(JSON.stringify(stats, null, 2));

    done();

  });

  //require('benchmarket').stop();

});
