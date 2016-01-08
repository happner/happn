describe('b8_security_https_websockets_sanity', function() {

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_secret = 'test_secret';
  var mode = "embedded";
  var default_timeout = 4000;
  var happnInstance = null;
  var test_id;

  var http = require('http');

  var http_request_options = {
    host: '127.0.0.1',
    port:55000
  };

  function doRequest(path, callback){
    http_request_options.path = path;
    http.request(http_request_options, function(e, response){


      
    }).end();
  }

  /*
  This test demonstrates starting up the happn service - 
  the authentication service will use authTokenSecret to encrypt web tokens identifying
  the logon session. The utils setting will set the system to log non priority information
  */

  before('should initialize the service', function(callback) {
    
    this.timeout(20000);

    test_id = Date.now() + '_' + require('shortid').generate();

    try{
      service.create({
          secureWebRoutes:'*'
        },function (e, happnInst) {
              if (e)
                return callback(e);

              happnInstance = happnInst;
              callback();

            });
    }catch(e){
      callback(e);
    }
  });

  after(function(done) {

    publisherclient.disconnect()
    .then(listenerclient.disconnect()
    .then(happnInstance.stop()
    .then(done)))
    .catch(done);

  });

  var publisherclient;
  var listenerclient;

  /*
    We are initializing 2 clients to test saving data against the database, one client will push data into the 
    database whilst another listens for changes.
  */
  before('should initialize the clients', function(callback) {
      this.timeout(default_timeout);

      try {
        happn_client.create(function(e, instance) {

          if (e) return callback(e);

          publisherclient = instance;
          happn_client.create(function(e, instance) {

            if (e) return callback(e);
            listenerclient = instance;
            callback();

          });

        });

      } catch (e) {
        callback(e);
      }

   });

  it('the server should set up a secure route', function (callback) {

    this.timeout(default_timeout);

    try {

      happnInstance.connect.use('/secure/route', function(req, res, next){

        console.log('in secure route:::', JSON.stringify({"secure":"value"}));

        //res.setHeader('Content-Type', 'application/json');
        res.end();

      });

      doRequest('/secure/route', function(response){



        callback();

      });

    } catch (e) {
      callback(e);
    }
  });


});