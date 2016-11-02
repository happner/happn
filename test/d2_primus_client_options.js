describe('d2_primus_client_options.js', function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;

  var test_secret = 'test_secret';
  var default_timeout = 10000;
  var happnInstance = null;

  var primusClient;

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  after(function (done) {
    happnInstance.stop(done);
  });

  before('should initialize the service', function (callback) {

    this.timeout(20000);

    try {
      service.create(function (e, happnInst) {
        if (e)
          return callback(e);

        happnInstance = happnInst;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });


  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  it('should initialize a client, check the standard configuration is in place', function (callback) {
    this.timeout(default_timeout);

    try {

      happn_client.create(function (e, instance) {

        if (e) return callback(e);
        primusClient = instance;

        expect(primusClient.pubsub.options.reconnect.retries).to.be(Infinity);
        expect(primusClient.pubsub.options.reconnect.max).to.be(180000);

        expect(primusClient.pubsub.recovery.retries).to.be(Infinity);
        expect(primusClient.pubsub.recovery.max).to.be(180000);

        primusClient.disconnect(callback);

      });
    } catch (e) {
      callback(e);
    }
  });

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  it('should initialize a client, and set up configurable options', function (callback) {
    this.timeout(default_timeout);

    try {

      happn_client.create({
          config:{
            pubsub:{
              options:{
                reconnect:{
                  retries:60,
                  max:2100000
                }
              }
            }
          }
        },function (e, instance) {

        if (e) return callback(e);
        primusClient = instance;

        expect(primusClient.pubsub.options.reconnect.retries).to.be(60);
        expect(primusClient.pubsub.options.reconnect.max).to.be(2100000);

        expect(primusClient.pubsub.recovery.retries).to.be(60);
        expect(primusClient.pubsub.recovery.max).to.be(2100000);

        primusClient.disconnect(callback);

      });
    } catch (e) {
      callback(e);
    }
  });

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  it('should initialize a client, and set up configurable options, not nested', function (callback) {
    this.timeout(default_timeout);

    try {

      happn_client.create({
        reconnect:{
          retries:50,
          max:2000000
        }
      },function (e, instance) {

        if (e) return callback(e);
        primusClient = instance;

        expect(primusClient.pubsub.options.reconnect.retries).to.be(50);
        expect(primusClient.pubsub.options.reconnect.max).to.be(2000000);

        expect(primusClient.pubsub.recovery.retries).to.be(50);
        expect(primusClient.pubsub.recovery.max).to.be(2000000);

        primusClient.disconnect(callback);

      });
    } catch (e) {
      callback(e);
    }
  });

  //require('benchmarket').stop();

});
