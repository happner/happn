describe('4_browser-client-test', function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');
  var request = require('request');

  var test_secret = 'test_secret';
  var happnInstance = null;

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  it('should initialize the service', function (callback) {

    this.timeout(20000);

    try {
      service.create(function (e, happnInst) {
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

  it('should fetch the browser client', function (callback) {

    this.timeout(5000);

    try {

      require('request')({
          uri: 'http://127.0.0.1:55000/browser_client',
          method: 'GET'
        },
        function (e, r, b) {

          if (!e) {

            var path = require('path');
            var happnPath = path.dirname(path.resolve(require.resolve('../lib/index'), '..' + path.sep));
            var happnVersion = require(happnPath + path.sep + 'package.json').version;
            expect(b.indexOf('\/\/happn client v' + happnVersion)).to.be(0);
            callback();
          } else callback(e);


        });

    } catch (e) {
      callback(e);
    }
  });

  //require('benchmarket').stop();

});
