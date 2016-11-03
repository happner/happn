var Primus = require('primus')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , uuid = require('node-uuid')
  , path = require('path')
  , Promise = require('bluebird')
  , async = require('async')
  ;

module.exports = SessionService;

function SessionService(opts) {

  this.log = opts.logger.createLogger('Session');
  this.log.$$TRACE('construct(%j)', opts);

  this.__sessions = {};
}

// Enable subscription to key lifecycle events
util.inherits(SessionService, EventEmitter);

SessionService.prototype.stats = function () {
  return {
    sessions: this.__sessions.length
  }
};

SessionService.prototype.__safeSessionData = function(sessionData){

  var safeSessionData = {

    "id": sessionData.id,
    "info": sessionData.info,
    "type": sessionData.type,
    "timestamp": sessionData.timestamp,
    "isEncrypted": sessionData.isEncrypted?true:false,
    "policy" : sessionData.policy,
    "token":sessionData.token,
    "encryptedSecret":sessionData.encryptedSecret

  };

  if (sessionData.user) safeSessionData.user = {username:sessionData.user.username, publicKey:sessionData.user.publicKey};

  return safeSessionData;
};

SessionService.prototype.attachSession = function(sessionId, session){

  var _this = this;

  _this.__updateSession(sessionId, session, function(e){
    if (e) return _this.happn.services.error.handleFatal('failed attaching session', e, 'session');
    else _this.emit('authentic', _this.__safeSessionData(session));
  });

  return session;

};

SessionService.prototype.__updateSession = function(sessionId, updated, callback){

  var _this = this;

  _this.__session_info.get(sessionId, function(e, sessionData){

    if (e) return callback(e);

    for (var propertyName in updated) sessionData[propertyName] = updated[propertyName];

    _this.__session_info.set(sessionId, sessionData, function(e){

      if (e) return callback(e);
      else callback(null, sessionData);

    });
  });
};

SessionService.prototype.getSession = function(sessionId, callback){

  var _this = this;

  _this.__session_info.get(sessionId, function(e, sessionData){

    if (e) return callback(e);

    if (sessionData) return callback(null, sessionData);
    else callback(null, null);

  });
};

SessionService.prototype.disconnectSession = function(sessionId, options){

  //TODO: session id's not matching - session from session servuce must be the same across the board
  var client = this.__sessions[sessionId];
  this.disconnect(client, options);
};

SessionService.prototype.each = function(eachHandler, callback){
  //the caller can iterate through the sessions
  var _this = this;
  var sessionKeys = Object.keys(_this.__sessions);

  if (sessionKeys.length == 0) return callback();

  async.each(sessionKeys, function(sessionKey, sessionKeyCallback){

    _this.__session_info.get(sessionKey, function(e, sessionData){

      if (e) return callback(e);

      if (sessionData)

        eachHandler.call(eachHandler, sessionData, function(e, update){

        if (e) return sessionKeyCallback(e);

        if (update) _this.__session_info.update(sessionKey, sessionData, sessionKeyCallback);

        else sessionKeyCallback();

      });
      else sessionKeyCallback();

    });
  }, callback);
};

SessionService.prototype.getClient = function(sessionId){
  return this.__sessions[sessionId];
};

SessionService.prototype.stop = function (options, callback) {
  try {

    var _this = this;

    if (typeof options == 'function') {
      callback = options;
      options = null;
    }

    if (!options) options = {};

    if (this.primus) {

      if (!options.timeout) options.timeout = 10000;

      var shutdownTimeout = setTimeout(function () {
        _this.log.error('primus destroy timed out after ' + options.timeout + ' milliseconds');
        _this.__shutdownTimeout = true;//instance level flag to ensure callback is not called multiple times
        callback();
      }, options.timeout);

      _this.disconnectAllClients(options, function(e){

        if (e) _this.log.error('failed disconnecting clients gracefully', e);

        _this.primus.destroy({
          // // have primus close the http server and clean up
          close: true,
          // have primus inform clients to attempt reconnect
          reconnect: typeof options.reconnect === 'boolean' ? options.reconnect : true
        }, function (e) {
          //we ensure that primus didn't time out earlier
          if (!_this.__shutdownTimeout) {
            clearTimeout(shutdownTimeout);
            callback(e);
          }
        });
      });
    }
    else callback();

  } catch (e) {
    callback(e);
  }
};

SessionService.prototype.initializeCaches = function(callback){

  var _this = this;

  var cacheConfig = {type:'static'};

  if (this.config.persistSessionCache){

    cacheConfig = {
      type:'persist',
      cache:{
        dataStore:_this.happn.services.data
      }
    };
  }

  _this.__session_info = _this.happn.services.cache.new('session_info', cacheConfig);
  callback();

};

SessionService.prototype.disconnectAllClients = function(options, callback){
  var _this = this;

  if (typeof options == 'function'){
    callback = options;
    options = {};
  }

  if (options.reconnect == null) options.reconnect = false;

  _this.each(function(sessionData, sessionDataCallback){

    var client = _this.getClient(sessionData.id);
    if (client) _this.disconnect(client, {"reason":"server-side-disconnect", "reconnect":options.reconnect}, sessionDataCallback);
    else sessionDataCallback();

  }, callback);

};

SessionService.prototype.initialize = function (config, callback) {
  var _this = this;

  try {

    if (!config) config = {};

    if (!config.timeout) config.timeout = false;

    if (!config.disconnectTimeout) config.disconnectTimeout = 1000;

    _this.config = config;

    _this.__shutdownTimeout = false;//used to flag an incomplete shutdown

    _this.__currentMessageId = 0;

    _this.primus = new Primus(_this.happn.server, config.primusOpts);
    _this.primus.on('connection', _this.onConnect.bind(_this));
    _this.primus.on('disconnection', _this.onDisconnect.bind(_this));

    var clientPath = path.resolve(__dirname, '../connect/public');

    // happner is using this to create the api/client package
    _this.script = clientPath + '/browser_primus.js';

    if (process.env.UPDATE_BROWSER_PRIMUS) _this.primus.save(_this.script);

    return _this.initializeCaches(callback);

  } catch (e) {
    callback(e);
  }
};

SessionService.prototype.localClient = Promise.promisify(function(config, callback){

  var _this = this;

  if (typeof config == 'function') {
    callback = config;
    config = {}
  }

  var ClientBase = require('../../client');
  var LocalPlugin = require('./localclient');

  ClientBase.create({
    config:config,
    plugin: LocalPlugin,
    context: _this.happn
  }, function(e, instance){
    if (e) return callback(e);
    callback(null, instance);
  });
});

SessionService.prototype.__configureSessionMessage = function(client, input, session){
  return {
    raw: {
      action:'ACK',
      input:input
    },
    session:session
  };
};

// so we can update the session data to use a different protocol, or start encrypting payloads etc
SessionService.prototype.__configureSession = Promise.promisify(function (message, client) {
  var _this = this;

  //limit what properties you are allowed to set
  var configuration = {
    protocol:message.protocol,
    isEncrypted:message.isEncrypted
  };

  _this.__updateSession(client.sessionId, configuration, function(e, sessionData){

    if (e) return _this.happn.services.error.handleFatal('failed configuring session', e, 'session');
    else{

      //TODO: maybe limit what you are allowed to see
      _this.happn.services.queue.pushOutbound(_this.__configureSessionMessage(client, message, sessionData))
        .then(function(){
          _this.emit('session-configured', sessionData);
        })
        .catch(_this.happn.services.error.handleSystem.bind(_this.happn.services.error))
    }
  });
});

SessionService.prototype.__discardMessage = function(message, client){
  //TODO: we dont want messages for non-existent sessions cluttering the queue
  return;
};

SessionService.prototype.handleMessage = Promise.promisify(function (message, client) {

  var _this = this;

  if (message.type == 'CONFIGURE_SESSION') return this.__configureSession(message, client);

  _this.__session_info.get(client.sessionId, function(e, sessionData){

    if (e) return _this.happn.services.error.handleSystem('failed getting session data for incoming request', 'session');

    if (!sessionData) return _this.__discardMessage(message, client);

    _this.__currentMessageId++;

    _this.happn.services.queue.pushInbound({raw:message, session:sessionData, id:_this.__currentMessageId})

    .then(function(processed){

      processed.response.__outbound = true;

      client.write(processed.response);
    })

    .catch(_this.happn.services.error.handleSystem.bind(_this.happn.services.error));

  });
});

SessionService.prototype.clientDisconnect = function (client, options, callback) {
  var _this = this;

  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  _this.__session_info.get(client.sessionId, function(e, sessionData) {

    if (!sessionData) {

      if (callback) return callback();//client was previously disconnected
      else return;
    }

    if (e) return _this.happn.services.error.handleFatal('failed getting session data from cache for disconnect', e, 'session');

    if (!options) options = {};
    options.clientDisconnected = true;

    _this.__finalizeDisconnect(client, sessionData, options, callback);

  });
};

SessionService.prototype.__finalizeDisconnect = function(client, sessionData, options, callback){

  var _this = this;

  if (typeof options === 'function'){
    callback = options;
    options = {};
  }

  options.reconnect = false;
  options.timeout = _this.config.disconnectTimeout;

  _this.happn.services.pubsub.clearSubscriptions(client.sessionId);

  _this.__session_info.remove(client.sessionId, function(e) {

    if (e) return _this.happn.services.error.handleFatal('failed removing session data from cache for disconnect', e, 'session');

    delete _this.__sessions[client.sessionId];

    _this.emit('disconnect', sessionData);//emit the disconnected event

    if (options.clientDisconnected) {//this means the spark is already disconnected - so we dont need to send it a disconnect message
      if (callback) return callback();
      else return;
    }

    _this.happn.services.queue.pushSystem({action:'disconnect', options:options, session:sessionData})

      .then(function(processed){

        try{

          processed.response.__outbound = true;

          client.on('end', function(){
            if (callback) callback();
          });

          client.end(processed.response, options);

        }catch(e){
          _this.happn.services.error.handleSystem(e);
        }
      })

      .catch(_this.happn.services.error.handleSystem.bind(_this.happn.services.error));
  });
};

SessionService.prototype.disconnect = function (client, options, callback) {

  var _this = this;

  _this.__session_info

  .get(client.sessionId)

  .then(function(sessionData){

    if (!sessionData) return callback(_this.happn.services.error.SystemError('no session data for disconnect'));

    client.__serverDisconnected = true;

    _this.__finalizeDisconnect(client, sessionData, options, callback);
  })

  .catch(function(e){

    if (e) return _this.happn.services.error.handleFatal('failed getting session data from cache for disconnect', e, 'session');
  });

};

SessionService.prototype.onConnect = function (client) {
  var _this = this;

  client.sessionId = uuid.v4();
  _this.__sessions[client.sessionId] = client;

  client.on('error', function (err) {
    _this.log.error('socket error', err);
  });

  client.on('data', function (message) {
    _this.handleMessage(message, client);
  });

  var sessionData = {
    id: client.sessionId,
    protocol:'happn_' + require('../../../package.json').protocol,
    happn:_this.happn.services.system.getDescription()
  };

  _this.__session_info.set(client.sessionId, sessionData, function(e){

    if (e) return _this.happn.services.error.handleFatal('failed adding session data to cache', e, 'session');
    _this.emit('connect', sessionData);
  });

};

SessionService.prototype.onDisconnect = function (client) {
  if (!client.__serverDisconnected) this.clientDisconnect(client);
};
