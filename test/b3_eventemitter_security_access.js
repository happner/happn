
var happn = require('../lib/index');
var serviceInstance;
var adminClient;
var expect = require('expect.js');
var test_id = Date.now() + '_' + require('shortid').generate();

describe('b3_eventemitter_security_access', function() {

  var getService = function(config, callback){
   happn.service.create(config,
      callback
    );
  }

  before('it starts completely defaulted service', function(done){

    getService({}, function(e, service){

      console.log(service);

      if (e) return done(e);

      serviceInstance = service;
      done();

    });

  });

  context('login', function() {

    it('authenticates with the _ADMIN user, using the default password', function(done) {

      happn.client.create({
        config:{username:'_ADMIN', password:'happn'},
        plugin: happn.client_plugins.intra_process,
        context: serviceInstance
      })

      .then(function(clientInstance){
        adminClient = clientInstance;
        done();
      })

      .catch(function(e){
        done(e);
      });

    });

    it('fails to authenticate with the _ADMIN user, using a bad password', function(done) {

      happn.client.create({
        config:{username:'_ADMIN', password:'bad'},
        plugin: happn.client_plugins.intra_process,
        context: serviceInstance
      })

      .then(function(clientInstance){
        done(new Error('this was not meant to happn...'));
      })

      .catch(function(e){
        console.log(e);
        expect(e._meta.error.name).to.be('AccessDenied');
        done();
      });

    });

  });

  context('resources access testing', function() {

    var testGroup = {
      name:'TEST GROUP' + test_id,
      custom_data:{
        customString:'custom1',
        customNumber:0
      }
    }

    var testUser = {
      username:'TEST USER@blah.com' + test_id,
      password:'TEST PWD',
      custom_data:{
        something: 'usefull'
      }
    }

    var addedTestGroup;
    var addedTestuser;

    it('creates a group and a user, adds the group to the user', function(done) {

      serviceInstance.services.security.upsertGroup(testGroup, {overwrite:false}, function(e, result){
        if (e) return done(e);
        addedTestGroup = result;

        serviceInstance.services.security.upsertUser(testUser, {}, function(e, result){

          if (e) return done(e);
          addedTestuser = result;
          serviceInstance.services.security.linkGroup(addedTestGroup, addedTestuser, done);

        });
      });
    });

     it('adds permissions to the upserted group', function(done) {

      testGroup.permissions = {
        /*
        '/TEST/b3_eventemitter_security_access/' + test_id + '/all_access':{actions:['*']},
        '/TEST/b3_eventemitter_security_access/' + test_id + '/get_access':{actions:[]},
        '/TEST/b3_eventemitter_security_access/' + test_id + '/on_access':{actions:[]},
        '/TEST/b3_eventemitter_security_access/' + test_id + '/remove_access':{actions:[]},
        '/TEST/b3_eventemitter_security_access/' + test_id + '/event':{actions:[]},
        '/TEST/b3_eventemitter_security_access/' + test_id + '/event/other':{actions:[]}
        */
      };

      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/all_access'] = {actions:['*']};

      serviceInstance.services.security.upsertGroup(testGroup, {}, function(e, group){
        if (e) return done(e);
        expect(group.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/all_access']).to.eql({actions:['*']});
        return done();
      });

    });
  });

  context('allowed on', function() {

    xit('works', function(done) {
      done();
    });

  });

  context('allowed set', function() {

    xit('works', function(done) {
      done();
    });

  });

  context('allowed get', function() {

    xit('works', function(done) {
      done();
    });

  });

  context('allowed get but not set', function() {

    xit('works', function(done) {
      done();
    });

  });

  context('allowed get and on but not set', function() {

    xit('works', function(done) {
      done();
    });

  });

  context('allowed get but not on', function() {

    xit('works', function(done) {
      done();
    });

  });

  context('allowed on but not get', function() {

    xit('works', function(done) {
      done();
    });

  });

  context('allowed set but not get', function() {

    xit('works', function(done) {
      done();
    });

  });

  context('allowed set but not on', function() {

    xit('works', function(done) {
      done();
    });

  });

  context('allowed set but not get', function() {

    xit('works', function(done) {
      done();
    });

  });

});
