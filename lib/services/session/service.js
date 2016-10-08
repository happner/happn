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

SessionService.prototype.updateSession = function(sessionId, session){

  this.__sessions[sessionId].sessionData = session;
};

SessionService.prototype.getSession = function(sessionId){

  return this.__sessions[sessionId].sessionData;
};

SessionService.prototype.disconnectSession = function(sessionId, message){

  throw new Error('unimplemented');
};

SessionService.prototype.each = function(eachHandler, callback){
  //the caller can iterate through the sessions
  var _this = this;
  var sessionKeys = Object.keys(_this.__sessions);

  if (sessionKeys.length == 0) return callback();

  async.each(sessionKeys, function(sessionKey, sessionKeyCallback){
    var session = _this.__sessions[sessionKey];
    if (session.sessionData) eachHandler.call(eachHandler, session.sessionData, sessionKeyCallback);
    else sessionKeyCallback();
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

      if (!options.timeout) options.timeout = 5000;

      var shutdownTimeout = setTimeout(function () {
        _this.log.error('primus destroy timed out after ' + options.timeout + ' milliseconds');
        _this.__shutdownTimeout = true;//instance level flag to ensure callback is not called multiple times
        callback();
      }, options.timeout);

      this.primus.destroy({
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
    }
    else
      callback();

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

SessionService.prototype.initialize = function (config, callback) {
  var _this = this;

  try {

    if (!config) config = {};

    if (config.timeout) config.timeout = false;

    _this.config = config;

    _this.__shutdownTimeout = false;//used to flag an incomplete shutdown

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

SessionService.prototype.ensureSessionProtocol = function (message, client) {

  if (client.sessionProtocol) return;

  if (message.protocol){
    client.sessionProtocol = message.protocol;
    return;
  }

  client.sessionProtocol = 'happn_' + require('../../../package.json').protocol;
};

SessionService.prototype.handleMessage = Promise.promisify(function (message, client) {

  var _this = this;

  this.ensureSessionProtocol(message, client);//ensure we have a protocol associated with our session

  _this.happn.services.queue.pushInbound({raw:message, sessionId:client.sessionId, protocol:client.sessionProtocol})

  .then(function(processed){
    client.write(processed.response);
  })

  .catch(_this.happn.services.error.handleSystem.bind(_this.happn.services.error));

});

SessionService.prototype.disconnect = function (client) {

  var _this = this;

  _this.happn.services.queue.pushInbound({raw:{action:'disconnect'}, sessionId:client.sessionId, protocol:'happn'})

    .then(function(){
      delete _this.__sessions[client.sessionId];
    })

    .catch(_this.happn.services.error.handleSystem.bind(_this.happn.services.error))
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
};

SessionService.prototype.onDisconnect = function (client) {
  this.disconnect(client);
};
