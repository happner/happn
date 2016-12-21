var Happn = require('../');
var expect = require('expect.js');

var service1Name;
//checks info is stored next to login
describe('e5-login-digest', function () {

  this.timeout(60000);

  var server1;

  before('starts the services', function (done) {

    Happn.service.create({secure:true})
      .then(function (server) {
        server1 = server;
        service1Name = server.name;
        done();
       })
      .catch(done);
  });

  after('stops the services', function (done) {
    if (!server1) done();
    server1.stop(function (e) {
      if (e) console.warn('failed to stop server1: ' + e.toString());

      done();

    });
  });

  it('logs in with digest authentication', function (done) {

    var testGroup2 = {
      name: 'TEST GROUP2',
      custom_data: {
        customString: 'custom2',
        customNumber: 0
      }
    };

    testGroup2.permissions = {
      '/@HTTP/secure/test/removed/user': {actions: ['get']},
      '/@HTTP/secure/test/not_removed/user': {actions: ['get']}
    };

    var Crypto = require('happn-util-crypto');
    var crypto = new Crypto();

    var keyPair = crypto.createKeyPair();

    var testUser2 = {
      username: 'TEST USER2@blah.com',
      password: 'TEST PWD',
      publicKey: keyPair.publicKey
    };

    var addedTestGroup2;
    var addedTestuser2;

    server1.services.security.upsertGroup(testGroup2, {overwrite: false}, function (e, result) {

      if (e) return done(e);
      addedTestGroup2 = result;

      server1.services.security.upsertUser(testUser2, {overwrite: false}, function (e, result) {

        if (e) return done(e);
        addedTestuser2 = result;

        server1.services.security.linkGroup(addedTestGroup2, addedTestuser2, function (e) {

          if (e) return done(e);

          Happn.client.create(
              {
                config:{
                  username:testUser2.username,
                  publicKey:testUser2.publicKey,
                  privateKey:keyPair.privateKey
                },
                loginType:'digest'
              }
            )

            .then(function (clientInstance) {
              done();
            })

            .catch(function (e) {
              done(e);
            });

        });
      });
    });
  });

});
