var expect = require('expect.js');
var happn = require('../lib/index');
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

var bitcore = require('bitcore');
var ECIES = require('bitcore-ecies');

describe('a9_security_encryption.js', function () {

  var testConfigs = {};

  testConfigs.data = {}

  testConfigs.security = {}

  var testServices = {};

  testServices.data = require('../lib/services/data_embedded/service');
  testServices.security = require('../lib/services/security/service');

  before('should initialize the service', function (callback) {

    var happnMock = {services: {}};

    async.eachSeries(['data', 'security'], function (serviceName, eachServiceCB) {

      testServices[serviceName] = new testServices[serviceName]();
      testServices[serviceName].happn = happnMock;

      testServices[serviceName].initialize(testConfigs[serviceName], function (e, instance) {
        if (e)  return eachServiceCB(e);

        happnMock.services[serviceName] = testServices[serviceName];

        eachServiceCB();

      });
    }, callback);

  });

  var generatedPrivateKeyBob = new bitcore.PrivateKey();
  var generatedPublicKeyBob = generatedPrivateKeyBob.publicKey;

  var generatedPrivateKeyAlice;
  var generatedPublicKeyAlice;

  var dataToEncrypt = 'this is a secret';
  var encryptedData;

  var badPrivateKey;
  var malformedPublicKey;

  it('should generate a keypair', function (callback) {

    var keyPair = testServices.security.generateKeyPair();

    generatedPrivateKeyAlice = keyPair.privateKey;
    generatedPublicKeyAlice = keyPair.publicKey;

    callback();

  });

  it('should serialize and deserialize a keypair', function (callback) {

    var keyPair = testServices.security.generateKeyPair();
    var keyPairSerialized = testServices.security.serializeKeyPair(keyPair);
    var keyPairDeserialized = testServices.security.deserializeKeyPair(keyPairSerialized);

    expect(typeof keyPairSerialized).to.be('string');
    expect(keyPairDeserialized.publicKey.toString()).to.be(keyPair.publicKey.toString());

    console.log('-------');
    console.log(keyPairDeserialized.toString());
    console.log(keyPair.toString());

    expect(keyPairDeserialized.privateKey.toString()).to.be(keyPair.privateKey.toString());

    callback();

  });

  it('should encrypt and decrypt data using the ECIES module directly', function (callback) {

    var bobSession = ECIES()
      .privateKey(generatedPrivateKeyBob)
      .publicKey(generatedPublicKeyAlice);

    var aliceSession = ECIES()
      .privateKey(generatedPrivateKeyAlice)
      .publicKey(generatedPublicKeyBob);

    var message = 'this is a secret';

    var encrypted = aliceSession
      .encrypt(message);

    var decrypted = bobSession
      .decrypt(encrypted);

    if (message == encrypted)
      throw new Error('ecrypted data matches secret message');

    if (message != decrypted)
      throw new Error('decrypted data does not match secret message');

    callback();

  });

  it('should encrypt and decrypt data using the security layer', function (callback) {
    var message = 'this is a secret';

    var encrypted = testServices.security.encryptAsymmetrical(generatedPrivateKeyAlice, generatedPublicKeyBob, message);
    var decrypted = testServices.security.decryptAsymmetrical(generatedPrivateKeyBob, generatedPublicKeyAlice, encrypted);

    if (message == encrypted)
      throw new Error('encrypted data matches secret message');

    if (message != decrypted)
      throw new Error('decrypted data does not match secret message');

    callback();

  });

  it('should encrypt and decrypt data using symmetric hashing in the security layer', function (callback) {

    var message = 'this is a secret';
    var hashed = testServices.security.generateHash(message, function (e, hash) {
      if (e)  return callback(e);

      var verified = testServices.security.verifyHash(message, hash, function (e, verified) {

        if (e)  return callback(e);
        expect(verified).to.be(true);
        callback();

      });

    });

  });


});
