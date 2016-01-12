describe('c1_security_pubpriv_login', function() {

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var happnInstance = null;
  var encryptedPayloadInstance = null;

  var test_id = Date.now() + '_' + require('shortid').generate();

  var http = require('http');

  var adminClient;
  var testClient;

  var bitcore = require('bitcore-lib');
  var ECIES = require('bitcore-ecies');

  /*
  This test demonstrates starting up the happn service - 
  the authentication service will use authTokenSecret to encrypt web tokens identifying
  the logon session. The utils setting will set the system to log non priority information
  */

  before('should initialize the service', function(callback) {
    
    this.timeout(20000);


    try{
      service.create({
          secure:true
        },function (e, happnInst) {
        if (e)
          return callback(e);

        happnInstance = happnInst;

        service.create({
            secure:true
          },function (e, happnInst) {
          if (e)
            return callback(e);

          encryptedPayloadInstance = happnInst;
          callback();

        });

      });
    }catch(e){
      callback(e);
    }
  });

  after(function(done) {

    adminClient.disconnect()
    .then(testClient.disconnect()
    .then(happnInstance.stop()
    .then(encryptedPayloadInstance.stop()
    .then(done))))
    .catch(done);


  });

  /*
    We are initializing 2 clients to test saving data against the database, one client will push data into the 
    database whilst another listens for changes.
  */
  before('should initialize the admin client and create a test user', function(callback) {
      
      happn.client.create({
        config:{username:'_ADMIN', password:'happn'},
        secure:true
      })

      .then(function(clientInstance){
        adminClient = clientInstance;
        callback();
      })

      .catch(function(e){
        callback(e);
      });

   });

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

    var keyPair = testServices.security.generateKeyPair();

    before('creates a group and a user, adds the group to the user, logs in with test user', function(done) {

      happnInstance.services.security.upsertGroup(testGroup, {overwrite:false}, function(e, result){

        if (e) return done(e);
        addedTestGroup = result;

        happnInstance.services.security.upsertUser(testUser, {overwrite:false}, function(e, result){

          if (e) return done(e);
          addedTestuser = result;

          happnInstance.services.security.linkGroup(addedTestGroup, addedTestuser, function(e){

            if (e) return done(e);

            

          });
        });
      });
    });

  it('logs in with the test client, without supplying a public key - attempts to encrypt a payload and fails', function (callback) {

    happn.client.create({
        config:{
          username:testUser.username, 
          password:'TEST PWD',
        },
        secure:true
      })

      .then(function(clientInstance){
        testClient = clientInstance;
        
        testClient.set('/an/encrypted/payload/target', {"encrypted":"test"}, {encryptPayload:true}, function(e, response){

          expect(e.toString()).to.equal('Error:missing session secret for encrypted payload, did you set the publicKey config option when creating the client?');
          callback();
          
        });
      })

      .catch(function(e){
        callback(e);
      });

  });

  it('logs in with the test client, supplying a public key - receives a sessionSecret and encrypts a payload using the option', function (callback) {

    happn.client.create({
      config:{
        username:testUser.username, 
        password:'TEST PWD',
        publicKey:keyPair.publicKey.toString();
      },
      secure:true
    })

    .then(function(clientInstance){
      testClient = clientInstance;
      expect(clientInstance.session.secret).to.not.equal(null);
      
      testClient.set('/an/encrypted/payload/target', {"encrypted":"test"}, {encryptPayload:true}, function(e, response){

        expect(e).to.equal(null);
        callback();

      });

    })

    .catch(function(e){
      callback(e);
    });

  });

  
  it('fails to log in with the test client, without supplying a public key to the default encryptPayload server', function (callback) {

    happn.client.create({
        config:{
          username:testUser.username, 
          password:'TEST PWD',
          port:10000
        },
        secure:true
      })

      .then(function(clientInstance){
        callback(new Error('this wasnt meant to happen'));
      })

      .catch(function(e){
        expect(e.toString()).to.equal('Error: no public key supplied for encrypted payloads');
        callback();
      });

  });

});