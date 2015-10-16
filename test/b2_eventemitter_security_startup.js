var expect = require('expect.js');
var happn = require('../lib/index');
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

var bitcore = require('bitcore');
var ECIES = require('bitcore-ecies');

describe('b2_eventemitter_security_groups', function () {

  var testConfigs = {};

  testConfigs.data = {

  }

  testConfigs.security = {
    
  }

  var testServices = {};

  var initializeMockServices = function (callback) {

    var happnMock = {services:{}};
    testServices = {};
    testServices.data = require('../lib/services/data_embedded/service');
    testServices.security = require('../lib/services/security/service');

    async.eachSeries(['data', 'security'], function(serviceName, eachServiceCB){

      testServices[serviceName] = new testServices[serviceName]();
      testServices[serviceName].happn = happnMock;

      testServices[serviceName].initialize(testConfigs[serviceName], function(e, instance){
        if (e)  return  eachServiceCB(e);

        happnMock.services[serviceName] = testServices[serviceName];
      
        eachServiceCB();

      });
    }, callback);

  }

  before('should initialize the service', initializeMockServices);

  it('should have a default keypair in memory', function (callback) {
     expect(testServices.security.keyPair != undefined).to.be(true);
     callback();
  });

   it('the default keypair in memory must exist in the system security leaf', function (callback) {
     expect(testServices.security.keyPair != undefined).to.be(true);

      testServices.data.get('/_SYSTEM/_SECURITY/SETTINGS/KEYPAIR', {}, function(e, response){

        if (e) return callback(e);

        if (!response) return callback(new Error('keypair doesnt exist in database'));



      });

     callback();
  });

  it('should have a default admin group', function (callback) {
    testServices.data.get('/_SYSTEM/_SECURITY/GROUP/ADMIN', {}, function(e, response){

      if (e) return callback(e);

      if (!response) return callback(new Error('admin group doesnt exist in database'));



    });
  });

  it('should have a default admin user', function (callback) {
    testServices.data.get('/_SYSTEM/_SECURITY/USER/ADMIN', {}, function(e, response){

       if (e) return callback(e);

       if (!response) return callback(new Error('admin user doesnt exist in database'));

    });
  });

  /*

  it('reinitializes services - with persisted db, should have same admin user & keypair', function (callback) {

    initializeMockServices(function(e){



    });

  });

  //we reset to only run in memory

  testConfigs.data = {
    
  }

  testConfigs.security = {
    
  }

  it('reinitializes services with specified admin user and keypair, admin user and keypair should match specified', function (callback) {

    initializeMockServices(function(e){

      

    });

  });
  
  */
 
});