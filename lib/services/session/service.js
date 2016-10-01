var Primus = require('primus')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , uuid = require('node-uuid')
  , path = require('path')
  , Promise = require('bluebird')
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

    var clientPath = path.resolve(__dirname, '../../public');

    // happner is using this to create the api/client package
    _this.script = clientPath + '/browser_primus.js';

    if (process.env.UPDATE_BROWSER_PRIMUS) _this.primus.save(_this.script);

    callback();

  } catch (e) {
    callback(e);
  }
};

SessionService.prototype.handleMessage = Promise.promisify(function (message, client) {

  var _this = this;

  _this.happn.services.queue.pushInbound({request:message, sessionId:client.sessionId})
    .then(function(processed){
      client.write(processed.response);
    })
    .catch(function(failed){
      return client.write(failed.response);
    });
});

SessionService.prototype.disconnect = function (client) {

  var _this = this;

  _this.happn.services.queue.pushInbound({request:{action:'disconnect'}, sessionId:client.sessionId})
    .then(function(response){
      delete _this.__clients[client.sessionId];
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
