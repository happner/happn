var shortid = require('shortid');
var uuid = require('node-uuid');

module.exports = CryptoService;

function CryptoService(opts) {

  var Logger;

  if (opts && opts.logger) {
    Logger = opts.logger.createLogger('Crypto');
  } else {
    Logger = require('happn-logger');
    Logger.configure({logLevel: 'info'});
  }

  this.log = Logger.createLogger('Crypto');
  this.log.$$TRACE('construct(%j)', opts);

}

CryptoService.prototype.initialize = function (config, callback) {

  this.config = config;

  var Crypto = require('happn-util-crypto');

  this.crypto = new Crypto();
  this.passwordHash = require('password-hash-and-salt');

  callback();
};

CryptoService.prototype.verifyHash = function (secret, hash, callback) {
  return this.passwordHash(secret).verifyAgainst(hash, callback);
};

CryptoService.prototype.generateHash = function (secret, callback) {
  return this.passwordHash(secret).hash(callback);
};

CryptoService.prototype.symmetricEncrypt = function (passphrase, salt, message) {
  return this.crypto.symmetricEncrypt(passphrase, salt, message);
};

CryptoService.prototype.symmetricDecrypt = function (passphrase, salt, message) {
  return this.crypto.symmetricDecrypt(passphrase, salt, message);
};

CryptoService.prototype.asymmetricEncrypt = function (publicKey, privateKey, message) {
  return this.crypto.asymmetricEncrypt(publicKey, privateKey, message);
};

CryptoService.prototype.asymmetricDecrypt = function (publicKey, privateKey, message) {
  return this.crypto.asymmetricDecrypt(publicKey, privateKey, message);
};

CryptoService.prototype.symmetricEncryptObject = function (obj, algorithm) {
  return this.crypto.symmetricEncryptObject(obj, algorithm);
};

CryptoService.prototype.symmetricDecryptObject = function (encrypted, algorithm) {
  return this.crypto.symmetricDecryptObject(encrypted, algorithm);
};

CryptoService.prototype.sign = function (hash, privateKey, hashEncoding) {
  return this.crypto.sign(hash, privateKey, hashEncoding);
};

CryptoService.prototype.verify = function (hash, signature, publicKey, hashEncoding) {
  try{
    return this.crypto.verify(hash, signature, publicKey, hashEncoding);
  }catch(e){
    return false;
  }
};

CryptoService.prototype.validatePublicKey = function (publicKey, encoding) {
  return this.crypto.validatePublicKey(publicKey, encoding);
};

CryptoService.prototype.validatePrivateKey = function (privateKey, encoding) {
  return this.crypto.validatePrivateKey(privateKey, encoding);
};

CryptoService.prototype.createKeyPair = function () {
  return this.crypto.createKeyPair();
};

CryptoService.prototype.keyPairFromWIF = function (wif) {
  return this.crypto.keyPairFromWIF(wif);
};

CryptoService.prototype.keyPairToWIF = function (keyPair) {
  return this.crypto.keyPairToWIF(keyPair);
};

CryptoService.prototype.serializeKeyPair = function (keypair, secret, salt) {

  var keyPairString = JSON.stringify(keypair);

  if (secret) return this.symmetricEncrypt(secret, keyPairString, salt);
  else return keyPairString;
};

CryptoService.prototype.deserializeKeyPair = function (string, secret, salt) {

  var keyPairString = string;

  if (secret) keyPairString = this.symmetricDecrypt(secret, string, salt);

  return JSON.parse(keyPairString);
};

CryptoService.prototype.generateNonce = function(randomValue){
  return this.crypto.generateNonce(randomValue);
};
