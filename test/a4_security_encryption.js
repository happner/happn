describe('a4_security_encryption.js', function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');
  var Logger = require('happn-logger');

  var Crypto = require('happn-util-crypto');
  var crypto = new Crypto();

  var testConfigs = {};

  testConfigs.data = {};

  testConfigs.crypto = {};

  var testServices = {};

  testServices.data = require('../lib/services/data/service');
  testServices.crypto = require('../lib/services/crypto/service');
  testServices.utils = require('../lib/services/utils/service');

  before('should initialize the service', function (callback) {

    var happnMock = {services: {}};

    async.eachSeries(['utils','data', 'crypto'], function (serviceName, eachServiceCB) {

      testServices[serviceName] = new testServices[serviceName]({logger: Logger});
      testServices[serviceName].happn = happnMock;

      happnMock.services[serviceName] = testServices[serviceName];

      if (!happnMock.services[serviceName].initialize) return eachServiceCB();

      else testServices[serviceName].initialize(happnMock.services[serviceName], eachServiceCB);

    }, callback);
  });

  var bobKeyPair = crypto.createKeyPair();

  var generatedPrivateKeyBob = bobKeyPair.privateKey;
  var generatedPublicKeyBob = bobKeyPair.publicKey;

  var generatedPrivateKeyAlice;
  var generatedPublicKeyAlice;

  var dataToEncrypt = 'this is a secret';
  var encryptedData;

  var badPrivateKey;
  var malformedPublicKey;

  it('should generate a keypair', function (callback) {

    var keyPair = testServices.crypto.createKeyPair();

    generatedPrivateKeyAlice = keyPair.privateKey;
    generatedPublicKeyAlice = keyPair.publicKey;

    callback();

  });

  it('should serialize and deserialize a keypair', function (callback) {

    var keyPair = testServices.crypto.createKeyPair();
    var keyPairSerialized = testServices.crypto.serializeKeyPair(keyPair);
    var keyPairDeserialized = testServices.crypto.deserializeKeyPair(keyPairSerialized);

    expect(typeof keyPairSerialized).to.be('string');
    expect(keyPairDeserialized.publicKey.toString()).to.be(keyPair.publicKey.toString());
    expect(keyPairDeserialized.privateKey.toString()).to.be(keyPair.privateKey.toString());

    callback();

  });

  it('should encrypt and decrypt data using the security layer', function (callback) {
    var message = 'this is a secret';

    var encrypted = testServices.crypto.asymmetricEncrypt(generatedPublicKeyBob, generatedPrivateKeyAlice, message);
    var decrypted = testServices.crypto.asymmetricDecrypt(generatedPublicKeyAlice, generatedPrivateKeyBob, encrypted);

    if (message == encrypted)
      throw new Error('encrypted data matches secret message');

    if (message != decrypted)
      throw new Error('decrypted data does not match secret message');

    callback();

  });

  it('should encrypt and decrypt data using symmetric hashing in the security layer', function (callback) {

    var message = 'this is a secret';
    var hashed = testServices.crypto.generateHash(message, function (e, hash) {
      if (e)  return callback(e);

      var verified = testServices.crypto.verifyHash(message, hash, function (e, verified) {

        if (e)  return callback(e);
        expect(verified).to.be(true);
        callback();

      });

    });

  });

  //require('benchmarket').stop();

});
