var expect = require('expect.js');
var happn = require('../lib/index');
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

describe('a9_security_encryption.js', function () {

  var securityService;

  before('should initialize the service', function (callback) {

    securityService = require('../lib/services/security/service');
    securityService.initialize({}, callback);

  });

  var generatedPrivateKey;
  var generatedPublicKey;
  var dataToEncrypt;
  var encryptedData;
  var badPrivateKey;
  var malformedPublicKey;

  it('should generate a key pair', function (callback) {

     callback(new Error('not implemented'));

  });

  it('should encrypt data using the generated public key', function (callback) {

     callback(new Error('not implemented'));

  });

  it('should decrypt data using the generated private key', function (callback) {

     callback(new Error('not implemented'));

  });

  it('should fail to encrypt data using a malformed public key', function (callback) {

     callback(new Error('not implemented'));

  });

  it('should fail decrypt data using a bad private key', function (callback) {

     callback(new Error('not implemented'));

  });

  var existingPrivateKey;
  var existingPublicKey;

  it('should initialize a service with an existing keypair', function (callback) {

    callback(new Error('not implemented'));

  });

  it('should encrypt data using the existing public key', function (callback) {

     callback(new Error('not implemented'));

  });

  it('should decrypt data using the existing private key', function (callback) {

     callback(new Error('not implemented'));

  });

});