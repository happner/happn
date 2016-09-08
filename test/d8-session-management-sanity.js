describe('d8_session_management', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var serviceInstance;
  var clientInstance;

  before('starts up happn instance with session management switched on', function(){

    var serviceConfig = {
      secure: true,
      services:{
        security:{
          config:{
            activateSessionManagement:true
          }
        }
      }
    };

    service.create(serviceConfig,
      function (e, happnInst) {
        if (e)
          return callback(e);

        serviceInstance = happnInst;

        happn_client.create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          }
        }, function (e, instance) {

          if (e) return callback(e);

          clientInstance = instance;

          callback();

        });
      });
  });

  it('tests session events on an unsecured mesh', function (callback) {



  });

  it('tests session events on a secure mesh', function (callback) {

    sessionEventsTest({secure: true}, callback);

  });

  require('benchmarket').stop();

});
