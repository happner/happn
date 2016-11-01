var Promise = require('bluebird')
  ;

module.exports = ProtocolHappn;

function ProtocolHappn(opts) {
  if (!opts) opts = {};
  this.opts = opts;
}

ProtocolHappn.prototype.__validateIn = Promise.promisify(function(message, callback){

  var _this = this;

  try{

    if (message.raw.encrypted) return callback(null, message); //we'll have to do this later

    if (!message.raw.action) throw _this.happn.services.error.ValidationError('message must have an action property');
    if (['on', 'get', 'set', 'off', 'remove', 'describe', 'emit', 'login', 'disconnect','request-nonce'].indexOf(message.raw.action) == -1) throw _this.happn.services.error.ValidationError('Unknown request action: ' + message.raw['action']);

    callback(null, message);

  }catch(e){
    callback(e);
  }
});

ProtocolHappn.prototype.validateIn = Promise.promisify(function(message, callback){
  return this.__validateIn(message, callback);
});

ProtocolHappn.prototype.validateOut = Promise.promisify(function(message, callback){

  return callback(null, message);

});

ProtocolHappn.prototype.transformIn = Promise.promisify(function(message, callback){

  try{

    var _this = this;

    if (message.raw.action  == 'login' && message.raw.data && message.raw.data.encrypted) {

      message.request = {action: message.raw.action};

      if (message.raw.data.encrypted.type == 'Buffer') message.raw.data.encrypted = message.raw.data.encrypted.data;

      message.request.data = JSON.parse(_this.happn.services.crypto.asymmetricDecrypt(message.raw.data.publicKey, _this.happn.services.security._keyPair.privateKey, message.raw.data.encrypted).toString());
      message.request.publicKey = message.raw.data.publicKey;
      message.request.eventId = message.raw.eventId;

      message.request.data.isEncrypted = true;//letting the security service know by adding this to the credentials
      message.session.isEncrypted = true;//for this call down as well

      delete message.raw.data.encrypted;

      return callback(null, message);
    }

    else if (message.raw.encrypted){

      message.request = _this.happn.services.crypto.symmetricDecryptObject(message.raw.encrypted, message.session.secret);
      delete message.raw.encrypted;
    }

    else message.request = message.raw;//no transform necessary

    if (message.request.options){
      //there will be some options that will modify the data
      if (message.request.action == 'set' && message.request.options.nullValue) message.request.data = null;//null values dont get passed across the wire
    }

    return callback(null, message);

  }catch(e){
    callback(e);
  }
});

ProtocolHappn.prototype.transformSystem = Promise.promisify(function(message, callback){

  if (message.action == 'disconnect'){

    var options = message.options?message.options:{};

    if (options.reconnect == null) options.reconnect = true;
    if (options.reason == null) options.reason = 'server side disconnect';

    message.response = {_meta:{type:'system'}, eventKey:'server-side-disconnect', data:options.reason}, {reconnect:options.reconnect};
  }

  return callback(null, message);

});

ProtocolHappn.prototype.transformOut = Promise.promisify(function(message, callback){

  try{

      message.request = message.raw; //no change

      if (message.request.action == 'disconnect'){

        message.request.publication = {
          action:'disconnect',
          _meta:{
            type:'system',
            sessionId:message.session.id
          },
          eventKey:'server-side-disconnect',
          data:message.request.data
        };
      }

      return callback(null, message);

  }catch(e){
    callback(e);
  }

});

ProtocolHappn.prototype.__formatReturnItem = function (item) {

  if (!item) return null;

  if (!item.data) item.data = {};

  var returnItem = item.data;

  returnItem._meta = item._meta;

  return returnItem;
};

ProtocolHappn.prototype.__formatReturnItems = function (items, local) {

  if (items == null) items = [];

  if (!Array.isArray(items)) items = [items];

  var returnItems = [];

  items.forEach(function (item) {
    returnItems.push(this.__formatReturnItem(item, local));
  }.bind(this));

  return returnItems;
};

ProtocolHappn.prototype.__createResponse = function (e, message, response, opts) {

  var _meta = {};

  if (!opts) opts = {};

  if (response == null) response = {data: null};

  else{

    if (response._meta) _meta = response._meta;
    if (response.paths) response = response.paths;
  }

  _meta.type = 'response';
  _meta.status = 'ok';
  _meta.published = false;
  _meta.eventId = message.eventId;

  delete _meta._id;

  //we need these passed in case we are encrypting the resulting payload
  if (['login', 'describe'].indexOf(message.action) > -1) {
    _meta.action = message.action;
  } else {
    _meta.sessionId = message.sessionId;
    _meta.action = message.action;
  }

  response._meta = _meta;

  if (e) {

    response._meta.status = 'error';
    response._meta.error = {name: e.toString()};

    if (typeof e === 'object') {
      Object.keys(e).forEach(function (key) {
        response._meta.error[key] = e[key];
      });
    }

    return response;
  }

  // if (['set', 'remove'].indexOf(message.action) > -1) {
  //   if (!message.options || !message.options.noPublish) {
  //     this.publish(message, response);
  //   }
  //   return response;
  // }

  if (message.action == 'on' && (message.options.initialCallback || message.options.initialEmit)) response.data = this.__formatReturnItems(response.initialValues, opts.local);

  if (Array.isArray(response)) {

    response = this.__formatReturnItems(response, opts.local);

    if (!opts.local) response.push(_meta);//we encapsulate the meta data in the array, so we can pop it on the other side
    else response._meta = _meta;// the _meta is preserved as an external property because we arent having to serialize
  }

  return response;
};

ProtocolHappn.prototype.emit = Promise.promisify(function(message, session, callback){

  try{

    message.request.publication.protocol = this.happn.services.protocol.current();

    if (session.isEncrypted) message.request.publication = {encrypted:this.__encryptMessage(message.request.publication, session.secret)};

    message.request.publication.__outbound = true;
    this.happn.services.session.getClient(session.id).write(message.request.publication);

    callback(null, message);

  }catch(e){
    callback(e);
  }
});

ProtocolHappn.prototype.__encryptMessage = function(response, secret){
  return this.happn.services.crypto.symmetricEncryptObject(response, secret);
};

ProtocolHappn.prototype.__encryptLogin = function(request, response){
  return this.happn.services.crypto.asymmetricEncrypt(request.publicKey, this.happn.services.security._keyPair.privateKey, JSON.stringify(response));
};

ProtocolHappn.prototype.success = function(message){

  var _this = this;

  return new Promise(function(resolve, reject) {

    try{

      message.response = _this.__createResponse(null, message.request, message.response, message.opts);

      if (message.session.isEncrypted){

        if (message.request.action != 'login') {
          message.response.encrypted = _this.__encryptMessage(message.response, message.session.secret);
          delete message.response._meta;
        }
        else {
          message.response._meta.type = 'login';
          message.response.encrypted = _this.__encryptLogin(message.request, message.response, message.session.secret);
        }
        delete message.response.data;
      }

      return resolve(message);

    }catch(e){
      return reject(e);
    }
  });
};

ProtocolHappn.prototype.fail = function(e, message){

  var _this = this;

  return new Promise(function(resolve, reject) {

    try{
      //we need to use the raw incoming message here - as we dont know whether request has been populated yet
      message.response = _this.__createResponse(e, message.raw, message.response, message.opts);

      if (message.request.action != 'login')//there is no session secret if the login failed
        if (message.session.isEncrypted) message.response = _this.__encryptMessage(message.response, message.session.secret);

      return resolve(message);

    }catch(e){
      return reject(e);
    }
  });
};

