var expect = require('expect.js');
var happn = require('../lib/index');
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

var bitcore = require('bitcore');
var ECIES = require('bitcore-ecies');
var test_id = Date.now() + '_' + require('shortid').generate();
var Promise = require('bluebird');

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
      something: 'usefull'
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

      addedSubGroup = result;
      callback();

    });
  });

  it('should fail to create a group as it already exists', function (callback) {
    testServices.security.upsertGroup(testGroup, {overwrite:false}, function(e, result){

      if (e && e.toString() == 'Error: validation failure: group by the name ' + testGroup.name + ' already exists')
        return callback();

      callback(new Error('group was created or lookup failed', e));

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

      expect(results.length).to.be(6);
      callback();

    });
    
  });

  /*
  it('should list permissions for a group, by action', function (callback) {
    
    testServices.security.listPermissions(addedGroup, {action:['get']}, function(e, results){

      if (e) return callback(e);

      expect(results.length).to.be(1);
      callback();

    });
    
  });
  */

  var groupToRemove = {
    name:'GROUP TO REMOVE' + test_id,
    custom_data:{
      customString:'customSub1',
      customNumber:0
    }
  }

  it('should delete a group', function (callback) {

    testServices.security.createGroup(groupToRemove, function(e, result){

      if (e) return callback(e);

      testServices.security.deleteGroup(result, function(e, result){

        if (e) return callback(e);

        console.log(result);
        expect(result.group.deleted == 1);

        callback();

      });

    });

  });

  context('manage users', function() {

    it('should add a user', function (callback) {

      testServices.security.upsertUser(testUser, {overwrite: false}, function(e, result){
        if (e) return callback(e);

        delete result._meta;

        expect(result).to.eql({
          custom_data: {
            something: 'usefull',
          },
          password: testUser.password,
          // systemPath: '/_SYSTEM/_SECURITY/_USER/' + testUser.username,
          username: testUser.username,
        });

        testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + testUser.username, {},
          function(e, result){
            expect(result.data).to.eql({
              custom_data: {
                something: 'usefull',
              },
              username: testUser.username,
              password: testUser.password,
            });

            callback();

          }
        );
      });
    });


    it('should not add another user with the same name', function (callback) {

      testUser.username += '.org';

      testServices.security.upsertUser(testUser, {overwrite: false}, function(e, result){
        if (e) return callback(e);

        var user = result;

        testServices.security.upsertUser(user, {overwrite: false}, function(e, result){

          expect(e.toString()).to.equal('Error: User already exists');
          callback();

        });

      });

    });

    it('should update a user', function (callback) {

      testUser.username += '.net';

      testServices.security.upsertUser(testUser, function(e, result){
        if (e) return callback(e);

        var user = result;

        user.custom_data = {};
        user.password = 'XXX';

        testServices.security.upsertUser(testUser, function(e, result) {
          if (e) return callback(e);

          expect(result.password).to.equal('XXX');
          expect(result.custom_data).to.eql({});

          var user = result;

          delete user._meta;

          testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + user.username, {},
            function(e, result){

              expect(result.data).to.eql({
                custom_data: {},
                username: user.username,
                // systemPath: '/_SYSTEM/_SECURITY/_USER/' + user.username,
                password: user.password,
              });

              callback();

            }
          );

        });

      });

    });

    it.only('can delete a user', function (callback) {

      testUser.username += '.xx';

      testServices.security.upsertUser(testUser, function(e, user){
        if (e) return callback(e);

        testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + user.username, {},
          function(e, result){
            if (e) return callback(e);

            testServices.security.deleteUser(user, function(e, result) {
              if (e) return callback(e);

              expect(result.obj.data).to.eql({removed: 1});
              expect(result.tree.data).to.eql({removed: 0});

              testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + user.username, {},
                function(e, result){

                  expect(result).to.equal(null);
                  expect(result).to.equal(null);
                  callback();

                }
              );
            });
          }
        );
      });



      // testServices.security.deleteUser(testUser, function(e, result){
      //    if (e) return callback(e);
      //    addedUser = result;
      // });

    });

    context('delete a user that has groups', function () {

      it('removes the user', function(callback) {

        callback();

      });

      it('removes the group membership', function(callback) {

        callback();

      });

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