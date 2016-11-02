describe('b4_start_no_config', function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var happnInstance = null;
  var test_id;

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  it('should initialize the service with no config', function (callback) {

    this.timeout(20000);
    test_id = Date.now() + '_' + require('shortid').generate();

    try {

      service.create()

        .then(function (happnInst) {
          happnInstance = happnInst;
          callback();
        })

        .catch(callback)

      ;

    } catch (e) {
      callback(e);
    }

  });

  after(function (done) {
    happnInstance.stop(done);
  });

  //require('benchmarket').stop();

});
