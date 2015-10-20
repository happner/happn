
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

    var testClient;

    before('creates a group and a user, adds the group to the user, logs in with test user', function(done) {

      serviceInstance.services.security.upsertGroup(testGroup, {overwrite:false}, function(e, result){

        if (e) return done(e);
        addedTestGroup = result;

        serviceInstance.services.security.upsertUser(testUser, {overwrite:false}, function(e, result){

          if (e) return done(e);
          addedTestuser = result;

          serviceInstance.services.security.linkGroup(addedTestGroup, addedTestuser, function(e){

            if (e) return done(e);

            happn.client.create({
              config:{username:testUser.username, password:'TEST PWD'},
              plugin: happn.client_plugins.intra_process,
              context: serviceInstance
            })

            .then(function(clientInstance){
              testClient = clientInstance;
              done();
            })

            .catch(function(e){
              done(e);
            });

          });
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
      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/on'] = {actions:['on']};
      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/on_all/*'] = {actions:['on']};
      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/remove'] = {actions:['remove']};
      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/remove_all/*'] = {actions:['remove']};
      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/get'] = {actions:['get']};
      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/get_all/*'] = {actions:['get']};
      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/set'] = {actions:['set']};
      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/set_all/*'] = {actions:['set']};
      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/all/*'] = {actions:['*']};
      testGroup.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/comp/get_on'] = {actions:['get','on']};

      serviceInstance.services.security.upsertGroup(testGroup, {}, function(e, group){
        if (e) return done(e);
        expect(group.permissions['/TEST/b3_eventemitter_security_access/' + test_id + '/all_access']).to.eql({actions:['*']});
        return done();
      });

    });

    it('checks allowed on, and prevented from on', function(done) {

      testClient.on('/TEST/b3_eventemitter_security_access/' + test_id + '/on', {}, function(message){}, function(e){

        if (e) return done(e);

        testClient.on('/TEST/b3_eventemitter_security_access/dodge/' + test_id + '/on', {}, function(message){}, function(e){

          if (!e) return done(new Error('you managed to subscribe, which should be impossible based on your permissions'));

          expect(e.toString()).to.be('AccessDenied');
          done();

        });

      });

    });

    it('checks allowed set, and prevented from set', function(done) {

      testClient.set('/TEST/b3_eventemitter_security_access/' + test_id + '/set', {}, function(e, result){

        if (e) return done(e);

        expect(result._meta.path).to.be('/TEST/b3_eventemitter_security_access/' + test_id + '/set');

         testClient.set('/TEST/b3_eventemitter_security_access/dodge/' + test_id + '/set', {test:'test'}, {}, function(e, result){

          if (!e) return done(new Error('you just set data that you shouldnt have permissions to set'));
          expect(e.toString()).to.be('AccessDenied');
          done();

        });

      });

    });

    it('checks allowed get, and prevented from get', function(done) {

      testClient.get('/TEST/b3_eventemitter_security_access/' + test_id + '/get', {}, function(e, result){

        if (e) return done(e);
        expect(result._meta.path).to.be('/TEST/b3_eventemitter_security_access/' + test_id + '/get');

        testClient.get('/TEST/b3_eventemitter_security_access/dodge/' + test_id + '/get', {}, function(e, result){

          if (!e) return done(new Error('you managed to get data which you do not have permissions for'));
          expect(e.toString()).to.be('AccessDenied');
          done();
          
        });

      });

    });

    it('checks allowed get but not set', function() {

      testClient.get('/TEST/b3_eventemitter_security_access/' + test_id + '/get', {}, function(e, result){

        if (e) return done(e);
        expect(result._meta.path).to.be('/TEST/b3_eventemitter_security_access/' + test_id + '/get');
        
        testClient.set('/TEST/b3_eventemitter_security_access/' + test_id + '/get', {test:'test'}, {}, function(e, result){
          if (!e) return done(new Error('you just set data that you shouldnt have permissions to set'));
          expect(e.toString()).to.be('AccessDenied');
          done();
        });

      });

    });

    it('checks allowed get and on but not set', function() {

       testClient.get('/TEST/b3_eventemitter_security_access/' + test_id + '/comp/get_on', {}, function(e, result){

        if (e) return done(e);
        expect(result._meta.path).to.be('/TEST/b3_eventemitter_security_access/' + test_id + '/comp/get_on');

          testClient.on('/TEST/b3_eventemitter_security_access/' + test_id + '/comp/get_on', {}, function(message){}, function(e){
            if (e) return done(e);

            testClient.set('/TEST/b3_eventemitter_security_access/' + test_id + '/comp/get_on', {test:'test'}, {}, function(e, result){
              if (!e) return done(new Error('you just set data that you shouldnt have permissions to set'));
              expect(e.toString()).to.be('AccessDenied');
              done();
            });
          });
        });
    });

    xit('checks allowed get but not on', function() {

     

    });

    xit('checks allowed on but not get', function() {

     

    });

    xit('checks allowed set but not get', function() {

      

    });

    xit('checks allowed set but not on', function() {



    });

    xit('checks allowed set but not get', function() {



    });


  });

});
