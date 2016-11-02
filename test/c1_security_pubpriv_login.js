describe('c1_security_pubpriv_login', function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var async = require('async');

  var happnInstance = null;
  var encryptedPayloadInstance = null;

  var http = require('http');

  var admClient;

  var Crypto = require('happn-util-crypto');
  var crypto = new Crypto();

  var clientKeyPair = crypto.createKeyPair();
  var clientKeyPair1 = crypto.createKeyPair();
  var serverKeyPair = crypto.createKeyPair();

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  before('should initialize the service', function (callback) {

    this.timeout(20000);

    try {
      service.create({
        secure: true,
        encryptPayloads: true,
        services: {
          security: {
            config: {
              keyPair: {
                privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
                publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
              }
            }
          }
        }
      }, function (e, happnInst) {
        if (e)
          return callback(e);

        happnInstance = happnInst;

        service.create({
          secure: true,
          port: 10000,
          encryptPayloads: true,
          services: {
            security: {
              config: {
                keyPair: serverKeyPair
              }
            }
          }
        }, function (e, happnInst) {

          if (e) return callback(e);
          encryptedPayloadInstance = happnInst;
          callback();

        });

      });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {

    admClient.disconnect()
      .then(happnInstance.stop()
        .then(encryptedPayloadInstance.stop()
          .then(done)))
      .catch(done);

  });

  it('tests the keypairs', function (callback) {

    var message = 'this is a secret';

    var encrypted = crypto.asymmetricEncrypt(clientKeyPair.publicKey, serverKeyPair.privateKey, message);
    var decrypted = crypto.asymmetricDecrypt(serverKeyPair.publicKey, clientKeyPair.privateKey, encrypted);

    // var encrypted = crypto.asymmetricEncrypt(serverKeyPair.privateKey,  clientKeyPair.publicKey, message);
    // var decrypted = crypto.asymmetricDecrypt(clientKeyPair.privateKey, serverKeyPair.publicKey, encrypted);

    if (message == encrypted) throw new Error('encrypted data matches secret message');

    if (message != decrypted) throw new Error('decrypted data does not match secret message');

    callback();

  });

  it('tests static keypairs', function (callback) {

    var message = 'this is a secret';

    var encrypted = crypto.asymmetricEncrypt('AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2', 'FtRDNOH1gU4ShXsmGZQhLbrdzM/eMP0kkFB5x9IUPkI=', message);
    var decrypted = crypto.asymmetricDecrypt('A5pIYTF6P8ZG2/4SKi6a0W9dxSyaKD/t4lH/qEfKCZtx', 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=', encrypted);

    if (message == encrypted)
      throw new Error('encrypted data matches secret message');

    if (message != decrypted)
      throw new Error('decrypted data does not match secret message');

    callback();
  });

  it('logs in with the test client, supplying a public key - we check that we have a session secret', function (callback) {

    happn.client.create({
        config: {
          username: '_ADMIN',
          password: 'happn',
          keyPair: {
            publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
            privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
          }
        }
      })

      .then(function (clientInstance) {

        admClient = clientInstance;

        expect(admClient.session.secret).to.not.equal(undefined);
        expect(admClient.session.secret).to.not.equal(null);

        callback();
      })

      .catch(function (e) {
        callback(e);
      });

  });

  it('logs in with the test client, supplying a public key - receives a sessionSecret annd performs a set and get operation', function (callback) {

    happn.client.create({
        config: {
          username: '_ADMIN',
          password: 'happn',
          keyPair: clientKeyPair
        }
      })

      .then(function (clientInstance) {

        admClient = clientInstance;

        admClient.set('/an/encrypted/payload/target', {"encrypted": "test"}, {}, function (e, response) {

          expect(e).to.equal(null);
          expect(response.encrypted == "test").to.equal(true);

          admClient.get('/an/encrypted/payload/target', function (e, response) {

            expect(e).to.equal(null);
            expect(response.encrypted == "test").to.equal(true);

            callback();

          });

        });

      })

      .catch(function (e) {
        callback(e);
      });

  });

  it('logs in with the test client, supplying a public key - receives a sessionSecret annd performs an on operation', function (callback) {

    happn.client.create({
        config: {
          username: '_ADMIN',
          password: 'happn',
          keyPair: clientKeyPair
        }
      })

      .then(function (clientInstance) {

        admClient = clientInstance;

        admClient.on('/an/encrypted/payload/target/event', {count: 1}, function (data) {

          callback();

        }, function (e, response) {

          expect(e).to.equal(null);

          admClient.set('/an/encrypted/payload/target/event', {"test": "on"}, function (e, response) {
            if (e) return callback(e);
          })


        });

      })

      .catch(function (e) {
        callback(e);
      });

  });

  it('logs in with 2 test clients, supplying a public key - receives a sessionSecret annd performs an on operation between the 2 clients', function (callback) {

    happn.client.create({
        config: {
          username: '_ADMIN',
          password: 'happn',
          keyPair: clientKeyPair
        }
      })

      .then(function (clientInstance) {

        admClient = clientInstance;

        happn.client.create({
            config: {
              username: '_ADMIN',
              password: 'happn',
              keyPair: clientKeyPair1
            }
          })

          .then(function (clientInstance) {

            admClient1 = clientInstance;

            admClient1.on('/an/encrypted/payload/target/event', function (data) {

              callback();

            }, function (e, response) {

              expect(e).to.equal(null);

              admClient.set('/an/encrypted/payload/target/event', {"test": "on"}, function (e, response) {
                if (e) return callback(e);
              })


            });

          })

          .catch(function (e) {
            callback(e);
          });

      })

      .catch(function (e) {
        callback(e);
      });

  });


  xit('fails to log in with the test client, without supplying a public key to the default encryptPayload server', function (callback) {

    happn.client.create({
        config: {username: '_ADMIN', password: 'happn'},
        port: 10000,
        secure: true
      })

      .then(function (clientInstance) {
        callback(new Error('this wasnt meant to happen'));
      })

      .catch(function (e) {
        expect(e.toString()).to.equal('Error: no public key supplied for encrypted payloads');
        callback();
      });

  });


  //require('benchmarket').stop();

});
