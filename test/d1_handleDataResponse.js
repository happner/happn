describe('d1_handleDataResponse', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var testport = 8000;
  var test_secret = 'test_secret';
  var mode = "embedded";
  var default_timeout = 10000;
  var happnInstance = null;

  this.timeout(20000);

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  after(function (done) {
    happnInstance.stop(done);
  });

  before('should initialize the service', function (callback) {

    try {
      service.create({
          mode: 'embedded',
          services: {
            auth: {
              path: './services/auth/service.js',
              config: {
                authTokenSecret: 'a256a2fd43bf441483c5177fc85fd9d3',
                systemSecret: test_secret
              }
            },
            data: {
              path: './services/data_embedded/service.js',
              config: {}
            },
            pubsub: {
              path: './services/pubsub/service.js',
              config: {}
            }
          },
          utils: {
            log_level: 'info|error|warning',
            log_component: 'prepare'
          }
        },
        function (e, happnInst) {
          if (e)
            return callback(e);

          happnInstance = happnInst;
          callback();
        });
    } catch (e) {
      callback(e);
    }
  });


  var publisherclient;
  var listenerclient;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  before('should initialize the clients', function (callback) {
    this.timeout(default_timeout);

    try {

      happn_client.create({
        plugin: happn.client_plugins.intra_process,
        context: happnInstance
      }, function (e, instance) {

        if (e) return callback(e);

        publisherclient = instance;

        happn_client.create({
          plugin: happn.client_plugins.intra_process,
          context: happnInstance
        }, function (e, instance) {

          if (e) return callback(e);
          listenerclient = instance;
          callback();

        });

      });

    } catch (e) {
      callback(e);
    }
  });

  it('should test handleDataResponse error with handler', function (callback) {
    //e, message, response, handler, client
    happnInstance.services.pubsub.handleDataResponseLocal(
      new Error('test'),
      {
        action:'get'
      },
      undefined,
      function(e){
        expect(e.toString()).to.be('Error: test');
        callback();
      },
      {
        handle_error:function(e){

        }
      }
    );


  });

  it('should test handleDataResponse error without handler', function (callback) {
    //e, message, response, handler, client
    happnInstance.services.pubsub.handleDataResponseLocal(
      new Error('test'),
      {
        action:'get'
      },
      undefined,
      undefined,
      {
        handle_error:function(e){

        }
      }
    );

    callback();

  });


  require('benchmarket').stop();

});
