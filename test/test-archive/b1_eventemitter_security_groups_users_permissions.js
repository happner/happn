var expect = require('expect.js');
var happn = require('../../lib/index');
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

var bitcore = require('bitcore');
var ECIES = require('bitcore-ecies');
var test_id = Date.now() + '_' + require('shortid').generate();
var Promise = require('bluebird');
var HAPPNER_STOP_DELAY = 5000;

describe('b1_eventemitter_security_groups', function () {

  var testConfigs = {};

  testConfigs.data = {}

  testConfigs.security = {}

  var testServices = {};

  var initializeMockServices = function (callback) {

    var happnMock = {services: {}};

    happnMock.utils = require('../../lib/utils');

    testServices = {};
    testServices.data = require('.././service');
    testServices.security = require('../../lib/services/security/service');

    var checkpoint = require('../../lib/services/security/checkpoint');
    testServices.checkpoint = new checkpoint();

    async.eachSeries(['data', 'security'], function (serviceName, eachServiceCB) {

      testServices[serviceName] = new testServices[serviceName]();
      testServices[serviceName].happn = happnMock;

      testServices[serviceName].initialize(testConfigs[serviceName], function (e, instance) {
        if (e)  return eachServiceCB(e);

        happnMock.services[serviceName] = testServices[serviceName];

        eachServiceCB();

      });
    }, callback);

  }

  before('should initialize the service', initializeMockServices);

  context('checkpoint utility functions', function () {

    it('should get a permission-set key', function (callback) {

      var permissionSetKey = testServices.security.generatePermissionSetKey({
        groups: {
          'test1': 'test1',
          'test2': 'test2'
        }
      });
      expect(permissionSetKey).to.be('/test1//test2/');
      callback();

    });

    it(' should compare wildcards', function (callback) {

      expect(testServices.security.happn.utils.wildcardMatch('/test/compare1*', '/test/compare1/blah/*')).to.be(true);
      expect(testServices.security.happn.utils.wildcardMatch('/test/compare1/*', '/test/compare1/blah/*')).to.be(true);
      expect(testServices.security.happn.utils.wildcardMatch('/test/compare2/compare3/*', '/test/compare2/compare3/blah')).to.be(true);
      expect(testServices.security.happn.utils.wildcardMatch('/test/compare3/compare4/*', '/test/compare3/compare4/blah/blah')).to.be(true);
      expect(testServices.security.happn.utils.wildcardMatch('/test/compare4/*/compare5/*', '/test/compare4/blah/compare5/blah')).to.be(true);

      expect(testServices.security.happn.utils.wildcardMatch('/test/compare1/*', '/dodge/*')).to.be(false);
      expect(testServices.security.happn.utils.wildcardMatch('/test/compare2/*', '/dodge/explicit')).to.be(false);

      callback();

    });

    it(' should aggregate wildcards', function (callback) {

      var testWildcardDict = {
        '/test/1deep/*': "1deep",
        '/test/1deep/2deep*': "2deep",
        '/test/2deep/3deep/*': "3deep",
        '/test/2deep/3deep/4deep/*': "4deep",
        '/test/3deep/*/5deep/*': "5deep",
        '/test/3deep/4deep/5deep/*': "5deep",
      }

      var aggregated = testServices.security.happn.utils.wildcardAggregate(testWildcardDict);

      expect(aggregated['/test/1deep/*']).to.be("1deep");
      expect(aggregated['/test/1deep/2deep*']).to.be(undefined);
      expect(aggregated['/test/2deep/3deep/*']).to.be("3deep");
      expect(aggregated['/test/2deep/3deep/4deep/*']).to.be(undefined);
      expect(aggregated['/test/3deep/*/5deep/*']).to.be("5deep");
      expect(aggregated['/test/3deep/4deep/5deep/*']).to.be(undefined);

      callback();

    });

  });

  var testGroup = {
    name: 'TEST GROUP' + test_id,
    custom_data: {
      customString: 'custom1',
      customNumber: 0
    }
  }

  var subGroup = {
    name: 'TEST SUB GROUP' + test_id,
    custom_data: {
      customString: 'customSub1',
      customNumber: 1
    }
  }

  var testUser = {
    username: 'TEST USER@blah.com' + test_id,
    password: 'TEST PWD',
    custom_data: {
      something: 'usefull'
    }
  }

  var testPermissions = [];
  var addedGroup;

  it('should create a group', function (callback) {
    testServices.security.upsertGroup(testGroup, function (e, result) {

      if (e) return callback(e);

      expect(result.name == testGroup.name).to.be(true);
      expect(result.custom_data.customString == testGroup.custom_data.customString).to.be(true);
      expect(result.custom_data.customNumber == testGroup.custom_data.customNumber).to.be(true);

      addedGroup = result;
      callback();

    });
  });

  it('should create a sub group', function (callback) {
    testServices.security.upsertGroup(subGroup, {parent: addedGroup}, function (e, result) {

      if (e) return callback(e);

      expect(result.name == subGroup.name).to.be(true);
      expect(result.custom_data.customString == subGroup.custom_data.customString).to.be(true);
      expect(result.custom_data.customNumber == subGroup.custom_data.customNumber).to.be(true);

      addedSubGroup = result;
      callback();

    });
  });

  it('should fail to create a group as it already exists', function (callback) {
    testServices.security.upsertGroup(testGroup, {overwrite: false}, function (e, result) {

      if (e && e.toString() == 'Error: validation failure: group by the name ' + testGroup.name + ' already exists')
        return callback();

      callback(new Error('group was created or lookup failed', e));

    });
  });

  it('should get groups by group name', function (callback) {

    testServices.security.listGroups('TEST*', function (e, results) {

      if (e) return callback(e);

      expect(results.length).to.be(2);
      callback();

    });

  });

  it('gets a specific group', function (callback) {

    testServices.security.getGroup(testGroup.name, function (e, group) {
      if (e) return callback(e);

      expect(group.name).to.be(testGroup.name);
      callback();

    });

  });

  it('should add permissions to a group', function (callback) {

    testGroup.permissions = {};

    //add set permissions to a group
    testGroup.permissions['/b1_eventemitter_security_groups/' + test_id + '/permission_set'] = {action: ['set']};

    //add get permissions to a group
    testGroup.permissions['/b1_eventemitter_security_groups/' + test_id + '/permission_get'] = {action: ['get']};

    //add on permissions to a group
    testGroup.permissions['/b1_eventemitter_security_groups/' + test_id + '/permission_on'] = {action: ['on']};

    //add remove permissions to a group
    testGroup.permissions['/b1_eventemitter_security_groups/' + test_id + '/permission_remove'] = {action: ['remove']};

    //add all permissions to a group
    testGroup.permissions['/b1_eventemitter_security_groups/' + test_id + '/permission_all'] = {action: ['*']};

    //add all permissions to a wildcard group
    testGroup.permissions['/*' + test_id + '/permission_wildcard/all/*'] = {action: ['*']};

    //add set permissions to a wildcard group
    testGroup.permissions['/*' + test_id + '/permission_wildcard/set/*'] = {action: ['set']};

    //add multiple permissions to a wildcard group
    testGroup.permissions['/*' + test_id + '/permission_wildcard/multiple/*'] = {action: ['set', 'get']};

    //add multiple permissions to a group
    testGroup.permissions['/' + test_id + '/permission_wildcard/multiple'] = {action: ['set', 'on']};

    testServices.security.upsertGroup(testGroup, function (e, result) {

      expect(result.permissions['/b1_eventemitter_security_groups/' + test_id + '/permission_set'].action[0]).to.be('set');
      expect(result.permissions['/b1_eventemitter_security_groups/' + test_id + '/permission_get'].action[0]).to.be('get');
      expect(result.permissions['/b1_eventemitter_security_groups/' + test_id + '/permission_on'].action[0]).to.be('on');
      expect(result.permissions['/b1_eventemitter_security_groups/' + test_id + '/permission_remove'].action[0]).to.be('remove');
      expect(result.permissions['/b1_eventemitter_security_groups/' + test_id + '/permission_all'].action[0]).to.be('*');

      expect(result.permissions['/*' + test_id + '/permission_wildcard/multiple/*'].action[0]).to.be('set');
      expect(result.permissions['/' + test_id + '/permission_wildcard/multiple'].action[0]).to.be('set');

      expect(result.permissions['/*' + test_id + '/permission_wildcard/multiple/*'].action[1]).to.be('get');
      expect(result.permissions['/' + test_id + '/permission_wildcard/multiple'].action[1]).to.be('on');

      callback();

    });

  });

  var groupToRemove = {
    name: 'GROUP TO REMOVE' + test_id,
    custom_data: {
      customString: 'customSub1',
      customNumber: 0
    }
  }

  it('should delete a group', function (callback) {

    testServices.security.upsertGroup(groupToRemove, function (e, result) {

      if (e) return callback(e);

      testServices.security.deleteGroup(result, function (e, result) {

        if (e) return callback(e);

        expect(result.group.data.removed).to.be(1);

        testServices.security.listGroups(groupToRemove.name, function (e, results) {

          if (e) return callback(e);

          expect(results.length).to.be(0);

          callback();
        });


      });

    });

  });

  context('manage users', function () {

    it('should add a user', function (callback) {

      testServices.security.upsertUser(testUser, {overwrite: false}, function (e, result) {
        if (e) return callback(e);

        delete result['_meta'];
        delete result['password'];

        expect(result).to.eql({
          custom_data: {
            something: 'usefull',
          },
          username: testUser.username
        });

        testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + testUser.username, {},
          function (e, result) {

            expect(result.data.password != 'TEST PWD').to.be(true);

            delete result.data['password'];

            expect(result.data).to.eql({
              custom_data: {
                something: 'usefull',
              },
              username: testUser.username
            });

            callback();

          }
        );
      });
    });


    it('should not add another user with the same name', function (callback) {

      testUser.username += '.org';
      testUser.password = 'TSTPWD';

      testServices.security.upsertUser(testUser, {overwrite: false}, function (e, result) {
        if (e) return callback(e);

        var user = result;
        user.password = 'TSTPWD';

        testServices.security.upsertUser(user, {overwrite: false}, function (e, result) {

          expect(e.toString()).to.equal('Error: validation failure: user by the name ' + user.username + ' already exists');
          callback();

        });

      });

    });

    it('should update a user', function (callback) {

      testUser.username += '.net';
      testUser.password = 'TSTPWD';

      testServices.security.upsertUser(testUser, function (e, result) {
        if (e) return callback(e);

        var user = result;

        user.custom_data = {};
        user.password = 'XXX';

        testServices.security.upsertUser(user, function (e, result) {
          if (e) return callback(e);

          expect(result.custom_data).to.eql({});

          var user = result;

          delete user._meta;

          testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + user.username, {},
            function (e, result) {

              delete result.data['password'];

              expect(result.data).to.eql({
                custom_data: {},
                username: user.username
              });

              callback();

            }
          );

        });

      });

    });

    it('should list users', function (callback) {

      testServices.security.listUsers(testUser.username, function (e, users) {

        if (e) return callback(e);

        expect(users.length).to.be(1);

        testServices.security.listUsers('*', function (e, users) {

          if (e) return callback(e);

          expect(users.length).to.be(4);

          callback();

        });

      });

    });

    it('can delete a user', function (callback) {

      testUser.username += '.xx';
      testUser.password = 'TST';

      testServices.security.upsertUser(testUser, function (e, user) {
        if (e) return callback(e);

        testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + user.username, {},
          function (e, result) {
            if (e) return callback(e);

            testServices.security.deleteUser(user, function (e, result) {
              if (e) return callback(e);

              expect(result.obj.data).to.eql({removed: 1});
              expect(result.tree.data).to.eql({removed: 0});

              testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + user.username, {},
                function (e, result) {

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

      it('removes the user', function (callback) {

        callback();

      });

      it('removes the group membership', function (callback) {

        callback();

      });

    });

  });

  context('manage users and groups', function () {

    var linkGroup = {
      name: 'LINK GROUP' + test_id,
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    }

    var linkUser = {
      username: 'LINK USER@blah.com' + test_id,
      password: 'LINK PWD',
      custom_data: {
        something: 'usefull'
      }
    }

    var nonExistantGroup = {
      name: 'BAD LINK GROUP' + test_id,
      _meta: {
        path: '/SOME/DODGE/PATH'
      }
    }

    before('should create link between users and groups', function (done) {
      testServices.security.upsertGroup(linkGroup, function (e, result) {
        if (e) return done(e);
        linkGroup = result;

        testServices.security.upsertUser(linkUser, function (e, result) {
          if (e) return done(e);
          linkUser = result;
          done();
        });
      });
    });

    it('links a group to a user', function (callback) {

      testServices.security.linkGroup(linkGroup, linkUser, function (e) {

        if (e) return callback(e);

        testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + linkUser.username + '/_USER_GROUP/' + linkGroup.name, {},
          function (e, result) {

            if (e) return callback(e);

            expect(result != null).to.be(true);
            callback();
          }
        );

      });

    });

    it('gets a specific user - ensuring the group is now part of the return object', function (callback) {

      testServices.security.getUser(linkUser.username, function (e, user) {

        if (e) return callback(e);
        expect(user.groups[linkGroup.name] != null).to.be(true);
        callback();

      });

    });

    it('unlinks a group from a user', function (callback) {

      testServices.security.unlinkGroup(linkGroup, linkUser, function (e) {

        testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + linkUser.username + '/_USER_GROUP/' + linkGroup.name, {},
          function (e, result) {

            if (e) return callback(e);

            expect(result).to.be(null);
            callback();
          }
        );

      });

    });

    it('fails to link a non-existant group to a user', function (callback) {

      testServices.security.linkGroup(nonExistantGroup, linkUser, function (e) {

        if (!e) return callback(new Error('user linked to non existant group'));

        callback();

      });

    });

  });

  /*

   it('should add a user group', function (callback) {

   testServices.security.addUserGroup(testGroup, testUser, function(e, result){

   });

   });

   it('should remove a user group', function (callback) {

   testServices.security.removeUserGroup(testGroup, testUser, function(e, result){

   });

   });

   */

});
