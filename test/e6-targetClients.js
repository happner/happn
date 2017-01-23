describe('2_websockets_embedded_sanity', function () {

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_secret = 'test_secret';
  var mode = "embedded";
  var happnInstanceSecure = null;
  var happnInstance = null;
  var test_id;

  this.timeout(5000);

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  before('should initialize the services', function (callback) {


    test_id = Date.now() + '_' + require('shortid').generate();

    try {

      service.create({port:55002}, function (e, happnInst) {

        if (e) return callback(e);

        happnInstance = happnInst;

        console.log('created unsecured instance:::');

        service.create({secure:true, port:55003},function (e, happnInst) {

          if (e) return callback(e);

          happnInstanceSecure = happnInst;

          console.log('created secured instance:::');

          callback();
        });
      });
    } catch (e) {
      callback(e);
    }
  });

  var secureClient;
  var secureMiddleman;
  var client;
  var middleman;

  after(function (done) {

    this.timeout(20000);

    secureClient.disconnect({timeout:2000}, function(e){

      if (e) console.warn('issue disconnecting secureClient');

      secureMiddleman.disconnect({timeout:2000}, function(e){

        if (e) console.warn('issue disconnecting secureMiddleman');

        client.disconnect({timeout:2000}, function(e){

          if (e) console.warn('issue disconnecting client');

          middleman.disconnect({timeout:2000}, function(e){

            if (e) console.warn('issue disconnecting middleman');

            happnInstance.stop(function(e){

              if (e) console.warn('issue stopping unsecure instance');

              happnInstanceSecure.stop(function(e){

                if (e) console.warn('issue stopping secure instance');

                done();
              });
            });
          });
        });
      });
    });
  });

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  before('should initialize the clients', function (callback) {

    happn_client.create({port:55002}, function (e, instance) {

      if (e) return callback(e);
      client = instance;

      console.log('created client:::');

      happn_client.create({port:55002}, function (e, instance) {

        if (e) return callback(e);
        middleman = instance;

        console.log('created middleman:::');

        happn_client.create({port:55003, config:{username:'_ADMIN', password:'happn'}}, function (e, instance) {

          if (e) return callback(e);
          secureClient = instance;

          console.log('created secure client:::');

          happn_client.create({port:55003, config:{username:'_ADMIN', password:'happn'}}, function (e, instance) {

            if (e) return callback(e);
            secureMiddleman = instance;

            console.log('created secure middleman:::');

            callback();
          });
        });
      });
    });
  });

  it('should ensure a targeted publish does not go to an unsecured middle man', function (callback) {

    this.timeout(10000);

    var middlemanGotMessage = false;

    middleman.on('/targeted/*', function(message){

      console.log('MIDDLEMAN HAS MESSAGE:::', message);
      middlemanGotMessage = true;

    }, function(e){

      if (e) return callback(e);

      console.log('attached middleman:::');

      client.on('/targeted/*', function(message){

        console.log('HAVE MESSAGE:::', message);
        setTimeout(function(){

          if (middlemanGotMessage) return callback(new Error('middleman got message!!'));
          callback();

        }, 2000);

      }, function(e){

        if (e) return callback(e);

        console.log('attached client:::', client.session.id);

        client.set('/targeted/test', {test:'value'}, {targetClients:[client.session.id]}, function(e){
          if (e) return callback(e);

          console.log('did unsecured set:::');
        });
      });
    });
  });

  it('ensure an targeted publish gets to both unsecured clients', function (callback) {

    this.timeout(10000);

    var middlemanGotMessage = false;

    middleman.on('/grouptargeted/*', function(message){

      console.log('MIDDLEMAN HAS MESSAGE:::', message);
      middlemanGotMessage = true;

    }, function(e){

      if (e) return callback(e);

      console.log('attached middleman:::');

      client.on('/grouptargeted/*', function(message){

        console.log('HAVE MESSAGE:::', message);
        setTimeout(function(){

          if (!middlemanGotMessage) return callback(new Error('middleman got no message!!'));
          callback();

        }, 2000);

      }, function(e){

        if (e) return callback(e);

        console.log('attached client:::', client.session.id);

        client.set('/grouptargeted/test', {test:'value'}, {targetClients:[client.session.id, middleman.session.id]}, function(e){
          if (e) return callback(e);

          console.log('did unsecured set:::');
        });
      });
    });
  });

  it('ensures an un-targeted publish gets to both unsecured clients', function (callback) {

    this.timeout(10000);

    var middlemanGotMessage = false;

    middleman.on('/untargeted/*', function(message){

      console.log('MIDDLEMAN HAS MESSAGE:::', message);
      middlemanGotMessage = true;

    }, function(e){

      if (e) return callback(e);

      console.log('attached middleman:::');

      client.on('/untargeted/*', function(message){

        console.log('HAVE MESSAGE:::', message);
        setTimeout(function(){

          if (!middlemanGotMessage) return callback(new Error('middleman got no message!!'));
          callback();

        }, 2000);

      }, function(e){

        if (e) return callback(e);

        console.log('attached client:::', client.session.id);

        client.set('/untargeted/test', {test:'value'}, function(e){
          if (e) return callback(e);

          console.log('did unsecured set:::');
        });
      });
    });
  });

  it('should ensure a targeted publish does not go to an secured middle man', function (callback) {

    this.timeout(10000);

    var secureMiddlemanGotMessage = false;

    secureMiddleman.on('/targeted/*', function(message){

      console.log('MIDDLEMAN HAS MESSAGE:::', message);
      secureMiddlemanGotMessage = true;

    }, function(e){

      if (e) return callback(e);

      console.log('attached secureMiddleman:::');

      secureClient.on('/targeted/*', function(message){

        console.log('HAVE MESSAGE:::', message);
        setTimeout(function(){

          if (secureMiddlemanGotMessage) return callback(new Error('secureMiddleman got message!!'));
          callback();

        }, 2000);

      }, function(e){

        if (e) return callback(e);

        console.log('attached secureClient:::', secureClient.session.id);

        secureClient.set('/targeted/test', {test:'value'}, {targetClients:[secureClient.session.id]}, function(e){
          if (e) return callback(e);

          console.log('did unsecured set:::');
        });
      });
    });
  });

  it('ensure an targeted publish gets to both secured secureClients', function (callback) {

    this.timeout(10000);

    var secureMiddlemanGotMessage = false;

    secureMiddleman.on('/grouptargeted/*', function(message){

      console.log('MIDDLEMAN HAS MESSAGE:::', message);
      secureMiddlemanGotMessage = true;

    }, function(e){

      if (e) return callback(e);

      console.log('attached secureMiddleman:::');

      secureClient.on('/grouptargeted/*', function(message){

        console.log('HAVE MESSAGE:::', message);
        setTimeout(function(){

          if (!secureMiddlemanGotMessage) return callback(new Error('secureMiddleman got no message!!'));
          callback();

        }, 2000);

      }, function(e){

        if (e) return callback(e);

        console.log('attached secureClient:::', secureClient.session.id);

        secureClient.set('/grouptargeted/test', {test:'value'}, {targetClients:[secureClient.session.id, secureMiddleman.session.id]}, function(e){
          if (e) return callback(e);

          console.log('did unsecured set:::');
        });
      });
    });
  });

  it('ensures an un-targeted publish gets to both secured secureClients', function (callback) {

    this.timeout(10000);

    var secureMiddlemanGotMessage = false;

    secureMiddleman.on('/untargeted/*', function(message){

      console.log('MIDDLEMAN HAS MESSAGE:::', message);
      secureMiddlemanGotMessage = true;

    }, function(e){

      if (e) return callback(e);

      console.log('attached secureMiddleman:::');

      secureClient.on('/untargeted/*', function(message){

        console.log('HAVE MESSAGE:::', message);
        setTimeout(function(){

          if (!secureMiddlemanGotMessage) return callback(new Error('secureMiddleman got no message!!'));
          callback();

        }, 2000);

      }, function(e){

        if (e) return callback(e);

        console.log('attached secureClient:::', secureClient.session.id);

        secureClient.set('/untargeted/test', {test:'value'}, function(e){
          if (e) return callback(e);

          console.log('did unsecured set:::');
        });
      });
    });
  });

});
