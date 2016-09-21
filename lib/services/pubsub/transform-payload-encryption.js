function TransformPayloadEncryption(){

}

TransformPayloadEncryption.prototype.initialize = function(config, callback){
  this.config = config;

  callback();
};

TransformPayloadEncryption.prototype.incoming = function(packet, next){

  try {

    if (packet.data.action == 'login') {

      if (packet.data.data.encrypted.type == 'Buffer') packet.data.data.encrypted = packet.data.data.encrypted.data;

      var publicKey = packet.data.data.publicKey;

      packet.data.data = JSON.parse(this.__pubsub.happn.services.crypto.asymmetricDecrypt(publicKey, this.__pubsub.happn.services.security._keyPair.privateKey, packet.data.data.encrypted).toString());
      packet.data.data.publicKey = publicKey;
      delete packet.data.data.encrypted;

    } else if (packet.data.action == 'describe') {
      return next();
    } else {
      var session = this.__pubsub.getSession(packet.data.sessionId);
      packet.data = this.__pubsub.happn.services.crypto.symmetricDecryptObject(packet.data.encrypted, session.secret);
    }
  } catch (e) {
    return next(e);
  }

  next();
};

TransformPayloadEncryption.prototype.outgoing = function(packet, next){

  try {

    //the _meta may have been added to the array, but for socket connections it is embedded as the last
    //item in the array
    if (Array.isArray(packet.data)) {
      packet = {
        data: {
          _meta: packet._meta ? packet._meta : packet.data[packet.data.length - 1],
          data: packet.data
        }
      }
    }

    if (packet.data._meta.action == 'login') {

      if (packet.data._meta && packet.data._meta.status == 'error') return next();

      packet.data.encrypted = this.__pubsub.happn.services.crypto.asymmetricEncrypt(packet.data.data.user.publicKey, this.__pubsub.happn.services.security._keyPair.privateKey, JSON.stringify(packet.data));
      packet.data._meta = {type: 'login'};
      packet.data.publicKey = this.__pubsub.happn.services.security._keyPair.publicKey;

      delete packet.data.data;

    }
    else if (packet.data._meta.action == 'describe') {

      return next();

    } else {

      var session = this.__pubsub.getSession(packet.data._meta.sessionId);
      packet.data.encrypted = this.__pubsub.happn.services.crypto.symmetricEncryptObject(packet.data, session.secret);

      delete packet.data.data;
      delete packet.data._meta;

    }
  } catch (e) {
    return next(e);
  }

  next();
};

module.exports = TransformPayloadEncryption;
