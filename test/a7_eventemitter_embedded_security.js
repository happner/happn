var expect = require('expect.js');
var happn = require('../lib/index')
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

describe('a6_eventemitter_embedded_security', function () {

  var testport = 8000;
  var test_secret = 'test_secret';
  var mode = "embedded";
  var happnInstance = null;
  var testUserName = 'admin';
  var testUserPassword = 'password';
  /*
   This test works with the security layer, and verifies the basic functionality
  */

  before('should initialize the service', function (callback) {

    this.timeout(20000);

    try {
      service.create({
          mode: 'embedded',
          services: {
            auth: {
              path: './services/auth/service.js',
              config: {
                authTokenSecret: 'a256a2fd43bf441483c5177fc85fd9d3',
                systemSecret: test_secret
              },
              super:{
                username:testUserName,
                password:testUserPassword
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
        function (e, happn) {
          if (e)
            return callback(e);

          happnInstance = happn;
          callback();
        });
    } catch (e) {
      callback(e);
    }
  });

  after(function(done) {
    happnInstance.stop(done);
  });


  var adminclient;
  

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the 
   database whilst another listens for changes.
   */
  before('should initialize the admin client', function (callback) {

    
 
    happn_client
    .create({
      plugin: happn.client_plugins.intra_process,
      context: happnInstance
    })
    .login(testUserName, testUserPassword)
    .then(function(){
      callback();
    })
    .catch(callback)

  });

  xit('should create a new group', function (callback) {

   

    
  });

  xit('should update a group', function (callback) {

  

    
  });


  xit('should add permissions to a group', function (callback) {

    

    
  });

  xit('should create a new user, should check the users password is encrypted', function (callback) {

    

    
  });

  xit('should update a user', function (callback) {

    

    
  });

  xit('should add groups to a user', function (callback) {

    

    
  });

  xit('should login with a user', function (callback) {

    

    
  });

  xit('should test a user with the correct group has read access', function (callback) {

    

    
  });

  xit('should test a user with the correct group has write access', function (callback) {

    

    
  });

  xit('should test a user with the correct group has remove access', function (callback) {

    

    
  });

  xit('should test a user with the incorrect group has not got read access', function (callback) {

    

    
  });

  xit('should test a user with the incorrect group has not got write access', function (callback) {

    

    
  });

   xit('should test a user with the incorrect group has not got remove access', function (callback) {

    

    
  });

   xit('should add more groups to a user', function (callback) {

    

    
  });

  xit('should test a user with the new group has now got read access', function (callback) {

    

    
  });

  xit('should test a user with the new group has now got write access', function (callback) {

    

    
  });

  xit('should test a user with the new group has now got remove access', function (callback) {

    

    
  });

   xit('should test a user with the incorrect group has not got security modification access', function (callback) {

    

    
  });

  xit('should change super users password', function (callback) {

    

    
  });


});