var Logger = require('happn-logger')
  , async = require('async')
  , shortid = require('shortid')
  , services = require('./services/manager')
  , version = require('../package.json').version
  , Promise = require('bluebird')
  ;

module.exports = {

  initialize: function (config, done) {
    console.warn('use of initialize when creating happn service is deprecated. use happn.service.create');
    return this.create(config, done);
  },

  create: Promise.promisify(function (config, done) {

    var instance = {};

    if (typeof config == 'function') {
      done = config;
      config = require('./config.js');
    }

    var happn = {
      services: {},
      config: config,
      connections: {}
    };

    instance.__initialized = false;

    if (!config.Logger && !Logger.configured) Logger.configure(config.utils);

    var log = (config.Logger || Logger).createLogger('HappnServer');
    log.context = happn.config.name;

    happn.log = log;

    services.initialize(config, happn, function (e) {

      if (e) {
        console.log('Failed to initialize services', e);
        return done(e);
      }

      happn.dropConnections = function () {
        //drop all connections
        for (var key in happn.connections) {
          happn.log.$$TRACE('killing connection', key);
          happn.connections[key].destroy();
        }

        log.$$TRACE('killed connections');
      };

      happn.stop = Promise.promisify(function (options, stopCB) {

        log.$$DEBUG('stopping happn');

        if (typeof options === 'function') {
          stopCB = options;
          options = {};
        }

        if (options.kill && !options.wait) options.wait = 10000;

        var kill = function () {
          process.exit(options.exitCode || 1);
        };

        if (options.kill) {
          setTimeout(function () {
            log.error('failed to stop happn, force true');
            kill();
          }, options.wait);
        }

        services.stop(function(e){

          if (e) return stopCB(e); // not stopping network

          //drop all connections
          happn.dropConnections();
          log.$$DEBUG('stopped services');

          stopCB();

        });
      });

      instance.__config = config;
      instance.__initialized = true;

      happn.__listening = false;
      happn.__erroredOnStart = false;
      happn.__listeningOn = false;
      happn.__errorOn = false;

      Object.defineProperty(happn, '__factory', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: instance
      });

      happn.listen = function (host, port, callback) {

        if (happn.__listening) return callback(new Error('already listening'));
        if (!happn.__factory.__initialized) return done(new Error('main happn service not initialized'));

        if (typeof host == 'function') {
          callback = host;
          host = null;
          port = null;
        }

        if (typeof port == 'function') {
          callback = port;
          port = null;
        }

        // preserve zero as valid port number
        port = port !== 'undefined' ? port : happn.__defaultPort;

        //nulls aren't provided for in the above
        if (port == null) port = happn.__defaultPort;

        //default host is local/any
        host = host || happn.__defaultHost;

        happn.__done = callback;

        if (!happn.__errorOn) {
          happn.server.on('error', function (e) {

            happn._lastError = e;
            happn.log.warn('http server error', e);

            // Error before listening achieved
            //
            // eg. EADDRINUSE
            if (happn.__done) {
              happn.__done(e, happn);
              happn.__done = null;//we only want this to be called once per call to listen
            }

          });
          happn.__errorOn = true;
        }

        if (!happn.__listeningOn) {
          happn.server.on('listening', function () {

            happn.__info = happn.server.address();
            happn.__listening = true;

            happn.log.info('listening at ' + happn.__info.address + ':' + happn.__info.port);
            happn.log.info('happn version ' + version);

            if (happn.__done) {
              happn.__done(null, happn); // <--- good, created a happn
              happn.__done = null;//we only want this to be called once per call to listen
            }

          });
          happn.__listeningOn = true;
        }

        happn.log.$$TRACE('listen()');
        happn.server.listen(port, host);

      };

      if (config.port == undefined || config.port == null) config.port = 55000;

      instance.__happn = happn;

      instance.__happn.__defaultHost = config.host == null ? '0.0.0.0' : config.host;
      instance.__happn.__defaultPort = config.port;

      if (!config.deferListen) instance.__happn.listen(done);
      else done(null, instance.__happn);


    });
  })
};
