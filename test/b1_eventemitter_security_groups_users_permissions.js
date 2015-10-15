var expect = require('expect.js');
var happn = require('../lib/index');
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

var bitcore = require('bitcore');
var ECIES = require('bitcore-ecies');
var test_id = Date.now() + '_' + require('shortid').generate();

describe('b1_eventemitter_security_groups', function () {

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

  var testGroup = {
    name:'TEST GROUP' + test_id,
    custom_data:{
      customString:'custom1',
      customNumber:0
    }
  }

  var subGroup = {
    name:'TEST SUB GROUP' + test_id,
    custom_data:{
      customString:'customSub1',
      customNumber:1
    }
  }

  var testUser = {
    username:'TEST USER@blah.com' + test_id,
    password:'TEST PWD',
    custom_data:{

    }
  }

  var testPermissions = [];
  var addedGroup;

  it('should create a group', function (callback) {
    testServices.security.upsertGroup(testGroup, function(e, result){

      if (e) return callback(e);

      console.log(e, result, testGroup);

      expect(result.name == testGroup.name).to.be(true);
      expect(result.custom_data.customString == testGroup.custom_data.customString).to.be(true);
      expect(result.custom_data.customNumber == testGroup.custom_data.customNumber).to.be(true);
      
      addedGroup = result;
      callback();

    });
  });

   it('should create a sub group', function (callback) {
    testServices.security.upsertGroup(subGroup,  {parent:addedGroup}, function(e, result){

      if (e) return callback(e);

      expect(result.name == subGroup.name).to.be(true);
      expect(result.custom_data.customString == subGroup.custom_data.customString).to.be(true);
      expect(result.custom_data.customNumber == subGroup.custom_data.customNumber).to.be(true);
      
      console.log('subgroup:::', result);

      addedSubGroup = result;
      callback();

    });
  });

  it('should get groups by group name', function (callback) {
    
    testServices.security.listGroups('TEST*', function(e, results){

      if (e) return callback(e);

      expect(results.length).to.be(2);
      callback();

    });
    
  });

  it('should add set permissions to a group', function (callback) {
    testServices.security.addPermission('/b1_eventemitter_security_groups/' + test_id + '/permission_set', {action:['set']}, addedGroup, function(e, result){
      if (e) return callback(e);

      expect(result.action[0] == 'set').to.be(true);
      callback();

    });
  });

  it('should add get permissions to a group', function (callback) {
    testServices.security.addPermission('/b1_eventemitter_security_groups' + test_id + '/permission_get', {action:['get']}, addedGroup, function(e, result){

      if (e) return callback(e);

      expect(result.action[0] == 'get').to.be(true);
      callback();

    });
  });

  it('should add a remove permission to a group', function (callback) {
    testServices.security.addPermission('/b1_eventemitter_security_groups' + test_id + '/permission_remove', {action:['remove']}, addedGroup, function(e, result){

      if (e) return callback(e);

      expect(result.action[0] == 'remove').to.be(true);
      callback();

    });
  });

  it('should add on permissions to a group', function (callback) {
    testServices.security.addPermission('/b1_eventemitter_security_groups' + test_id + '/permission_on', {action:['on']}, addedGroup, function(e, result){

      if (e) return callback(e);

      expect(result.action[0] == 'on').to.be(true);
      callback();

    });
  });

  it('should add all permissions to a group', function (callback) {
    testServices.security.addPermission('/b1_eventemitter_security_groups' + test_id + '/permission_all', {action:['*']}, addedGroup, function(e, result){

      if (e) return callback(e);

      expect(result.action[0] == '*').to.be(true);
      callback();

    });
  });

  it('should add all permissions to a group, including subkeys', function (callback) {
    testServices.security.addPermission('/b1_eventemitter_security_groups' + test_id + '/permission_all', {action:['*'], includeSubKeys:true}, addedGroup, function(e, result){

      if (e) return callback(e);

      expect(result.action[0] == '*').to.be(true);
      expect(result.includeSubKeys).to.be(true);

      callback();

    });
  });

  it('should ensure that if permission action is not specified, defaults to all', function (callback) {
    testServices.security.addPermission('/b1_eventemitter_security_groups' + test_id + '/permission_default', addedGroup, function(e, result){

       if (e) return callback(e);

      expect(result.action[0] == '*').to.be(true);
      callback();

    });
  });

  it('should list permissions for a group', function (callback) {
    
    testServices.security.listPermissions(addedGroup, function(e, results){

      if (e) return callback(e);

      expect(results.length).to.be(7);
      callback();

    });
    
  });

  it('should list permissions for a group, by action', function (callback) {
    
    testServices.security.listPermissions(addedGroup, {action:['get']}, function(e, results){

      if (e) return callback(e);

      expect(results.length).to.be(1);
      callback();

    });
    
  });

  it('should get groups by permission path and action', function (callback) {
    
    testServices.security.listGroups('*', {permission:{path:'/b1_eventemitter_security_groups*', action:['get']}}, function(e, results){

      if (e) return callback(e);

      expect(results.length).to.be(1);
      callback();

    });
    
  });

  it('should get groups that have permission to a path', function (callback) {

  });

  var groupToRemove = {
    name:'GROUP TO REMOVE' + test_id,
    custom_data:{
      customString:'customSub1',
      customNumber:0
    }
  }

  it('should remove a group', function (callback) {

    testServices.security.upsertGroup(groupToRemove, function(e, result){

      if (e) return callback(e);

      testServices.security.removeGroup(result, function(e, result){

        if (e) return callback(e);


      });

    });

  });

  var addedUser;

  it('should add a user', function (callback) {

    testServices.security.addUser(testUser, function(e, result){
       if (e) return callback(e);
       addedUser = result;
    });

  });

  it('the users password should be hashed in the database', function (callback) {
    
  });

  it('should add a user group', function (callback) {

    testServices.security.addUserGroup(testGroup, testUser, function(e, result){

    });
    
  });

  it('should remove a user group', function (callback) {

    testServices.security.removeUserGroup(testGroup, testUser, function(e, result){

    });
    
  });
 
});