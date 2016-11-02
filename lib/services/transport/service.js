var https = require('https');
var fs = require('fs');
var path = require('path');
var version = require('../../../package.json').version;
var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = TransportService;

function TransportService(){
  this.__listenRetries = 0;
  EventEmitter.call(this);
}

util.inherits(TransportService, EventEmitter);

TransportService.prototype.checkFileExists = function (path) {
  try {
    var fileStats = fs.statSync(path);

    if (fileStats.isFile()) return true;
    else return false;

  } catch (e) {
    return false;
  }
};

TransportService.prototype.createCertificate = function (keyPath, certPath, callback) {

  var pem = require('pem');

  pem.createCertificate({selfSigned: true}, function (err, keys) {

    if (err) return callback(err);

    fs.writeFileSync(keyPath, keys.serviceKey);
    fs.writeFileSync(certPath, keys.certificate);

    callback(null, {cert: keys.certificate, key: keys.serviceKey})

  });
};

TransportService.prototype.__createHttpsServer = function (options, app, callback) {

  try {

    var server = https.createServer(options, app);

    callback(null, server);
  } catch (e) {
    callback(new Error('error creating server: ' + e.message));
  }

};

TransportService.prototype.createServer = function (config, app, log, callback) {

  var _this = this;

  if (!config) config = {};

  if (!config.mode) config.mode = 'http';

  if (config.mode == 'http') return callback(null, require('http').createServer(app));

  else if (config.mode == 'https') {

    var options = {};

    if (config.cert && !config.key) return callback(new Error('key file missing for cert'));

    if (config.key && !config.cert) return callback(new Error('cert file missing key'));

    if (config.cert) {

      options.key = config.key;
      options.cert = config.cert;

    } else {

      if (!config.certPath) {

        var userHome = require('user-home');

        config.certPath = userHome + require('path').sep + '.happn-https-cert';
        config.keyPath = userHome + require('path').sep + '.happn-https-key';
      }

      var certFileExists = this.checkFileExists(config.certPath);
      var keyFileExists = this.checkFileExists(config.keyPath);

      if (certFileExists) {

        options.cert = fs.readFileSync(config.certPath);

        if (keyFileExists) options.key = fs.readFileSync(config.keyPath);

        else return callback(new Error('missing key file: ' + config.keyPath));

      } else {

        if (keyFileExists) return callback(new Error('missing cert file: ' + config.certPath));

        log.warn('cert file ' + config.certPath + ' is missing, trying to generate...');

        return this.createCertificate(config.keyPath, config.certPath, function (e, keys) {
          options = keys;
          _this.__createHttpsServer(options, app, callback);
        });
      }
    }

    _this.__createHttpsServer(options, app, callback);

  }
  else throw new Error('unknown transport mode: ' + config.mode + ' can only be http or https');

};

TransportService.prototype.listen = function (host, port, options, callback) {

  var _this = this;

  _this.happn.__listening = false;
  _this.happn.__erroredOnStart = false;
  _this.happn.__listeningOn = false;
  _this.happn.__errorOn = false;

  if (_this.happn.__listening) return callback(new Error('already listening'));
  if (!_this.happn.__factory.__initialized) return callback(new Error('main happn service not initialized'));

  if (typeof host == 'function') {
    callback = host;
    host = null;
    port = null;
  }

  if (typeof port == 'function') {
    callback = port;
    port = null;
  }

  if (typeof options === 'function'){
    callback = options;
    options = null;
  }

  // preserve zero as valid port number
  port = port !== 'undefined' ? port : _this.happn.__defaultPort;

  //nulls aren't provided for in the above
  if (port == null) port = _this.happn.__defaultPort;

  //default host is local/any
  host = host || _this.happn.__defaultHost;

  _this.happn.__done = callback;

  if (!options) options = {};
  if (!options.listenRetries) options.listenRetries = 4;
  if (!options.listenRetryInterval) options.listenRetryInterval = 2000;

  _this.__listenRetries = 0;

  if (!_this.happn.__errorOn) {

    _this.happn.server.on('error', function (e) {

      //_this.emit('error');
      _this.happn._lastError = e;
      _this.happn.services.log.warn('http server error', e);

      if ((e.code && e.code == 'EADDRINUSE') && _this.__listenRetries < options.listenRetries) {

        _this.__listenRetries ++;

        return setTimeout(function(){
          //_this.emit('listen-retry', _this.__listenRetries);
          _this.__tryListen(host, port);
        }, options.listenRetryInterval);
      }

      if (_this.happn.__done) {
        _this.happn.__done(e, _this.happn);
        _this.happn.__done = null;//we only want this to be called once per call to listen
      }
    });

    _this.happn.__errorOn = true;
  }

  _this.__tryListen({port:port, host:host});

};

TransportService.prototype.__tryListen = function(options){

  var _this = this;

  _this.happn.log.$$TRACE('listen()');

  if (!_this.happn.__listeningOn) {

    _this.happn.server.on('listening', function () {

      _this.happn.__info = _this.happn.server.address();
      _this.happn.__listening = true;

      _this.happn.log.info('listening at ' + _this.happn.__info.address + ':' + _this.happn.__info.port);
      _this.happn.log.info('_this.happn version ' + version);

      if (_this.happn.__done){
        _this.happn.__done(null, _this.happn); // <--- good, created a _this.happn
        _this.happn.__done = null;//we only want this to be called once per call to listen
      }

    });

    _this.happn.__listeningOn = true;
  }

  if (!options.portAvailablePingInterval) options.portAvailablePingInterval = 500;
  if (!options.portAvailablePingTimeout) options.portAvailablePingTimeout = 20000;//20 seconds

  var tcpPortUsed = require('tcp-port-used');

  tcpPortUsed.waitUntilFree(options.port, options.portAvailablePingInterval, options.portAvailablePingTimeout)
    .then(function() {
      _this.happn.server.listen(options.port, options.host);
    }, function(e){
      _this.happn.__done(e);
    });
};

TransportService.prototype.stop = function(options, callback){

  //drop all connections
  this.happn.dropConnections();
  callback();
};

TransportService.prototype.initialize = function(config, callback){

  var _this = this;

  _this.createServer(config, _this.happn.connect, _this.happn.log, function (e, server) {

    if (e) return callback(e);

    _this.happn.server = server;

    Object.defineProperty(_this.happn.server, 'listening', {
      get: function () {
        return instance.__happn.__listening;
      },
      enumerable: 'true'
    });

    _this.happn.dropConnections = function () {
      //drop all connections
      for (var key in _this.happn.connections) {

        _this.happn.log.$$TRACE('killing connection', key);
        _this.happn.connections[key].destroy();

      }

      _this.happn.log.$$TRACE('killed connections');
    };

    _this.happn.server.on('connection', function (conn) {

      var key = conn.remoteAddress + ':' + conn.remotePort;
      _this.happn.connections[key] = conn;

      conn.on('close', function () {
        delete _this.happn.connections[key];
      });

    });

    _this.happn.server.on('error', function (e) {
      _this.happn.log.warn('server error', e);
    });

    _this.happn.server.on('close', function (msg) {

      if (_this.happn.__info) _this.happn.log.info('released ' + _this.happn.__info.address + ':' + _this.happn.__info.port);
      else _this.happn.log.info('released, no info');
    });

    callback();

  });

};

