var Logger = require('happn-logger')
  , async = require('async')
  , connect = require('connect')
  , cookies = require('connect-cookies')
  , serveStatic = require('serve-static')
  , shortid = require('shortid')
  , Crypto = require('happn-util-crypto')
  , crypto = new Crypto()
  , bodyParser = require('body-parser')

  , utils = require('./utils')
  , transport = require('./transport')
  , services = require('./services')
  , version = require('../package.json').version
  ;

module.exports = {

  initialize: function (config, done) {
    console.warn('use of initialize when creating happn service is deprecated. use happn.service.create');
    return this.create(config, done);
  },

  create: utils.promisify(function (config, done) {

    var instance = {};

    if (typeof config == 'function') {
      done = config;
      config = {};
    }

    if (!config.utils) {
      config.utils = {
        logLevel: 'info'
      }
    }

    if (!config.utils.Logger && !Logger.configured) {
      Logger.configure(config.utils);
    }

    var log = (config.utils.Logger || Logger).createLogger('HappnServer');
    log.context = config.name;

    var happn = {
      services: {},
      config: config,
      log: log,
      connections: {}
    };

    var app = connect();

    app.use(serveStatic(__dirname + '/public'));
    app.use(bodyParser.json());
    app.use(cookies());

    var loadMiddleware = function (middleware_name) {
      log.$$TRACE('loadMiddleware( ' + middleware_name);

      var middleware = require('./middleware/' + middleware_name);

      middleware.happn = happn;
      app.use(middleware.process.bind(middleware));

      if (middleware['process_error'])
        app.use(middleware.process_error.bind(middleware));

      if (middleware['initialize']) {
        if (config.middleware) middleware.initialize(config.middleware[middleware_name]);
        else middleware.initialize();
      }
    };

    crypto.attacheMiddleware(app, '/browser_crypto.js');

    loadMiddleware('system');
    loadMiddleware('client');
    loadMiddleware('security');

    happn.utils = utils;
    happn.connect = app;

    instance.__initialized = false;

    config.transport = config.transport || {};

    transport.createServer(config.transport, app, log, function (e, server) {

      if (e) return done(e);

      happn.server = server;

      Object.defineProperty(happn.server, 'listening', {
        get: function () {
          return instance.__happn.__listening;
        },
        enumerable: 'true'
      });

      happn.server.on('connection', function (conn) {
        var key = conn.remoteAddress + ':' + conn.remotePort;
        happn.connections[key] = conn;
        conn.on('close', function () {
          delete happn.connections[key];
        });
      });

      happn.server.on('error', function (e) {
        log.warn('server error', e);
      });

      happn.server.on('close', function (msg) {
        if (happn.__info)
          log.info('released ' + happn.__info.address + ':' + happn.__info.port);
        else
          log.info('released, no info');
      });

      services.initialize(config, happn, log, function (e) {

        if (e) {
          log.fatal('Failed to initialize services', e);
          return done(e);
        }

        //how we collect stats from the various services and return them as a json object
        happn.stats = function (opts) {

          var stats = {};

          if (!opts)
            opts = {};

          for (var serviceName in happn.services) {
            stats[serviceName] = {};

            if (happn.services[serviceName].stats)
              stats[serviceName] = happn.services[serviceName].stats(opts[serviceName]);
          }

          return stats;
        };

        happn.dropConnections = function () {
          //drop all connections
          for (var key in happn.connections) {
            log.$$TRACE('killing connection', key);
            happn.connections[key].destroy();
          }

          log.$$TRACE('killed connections');
        };

        happn.stop = utils.promisify(function (options, stopCB) {

          log.$$DEBUG('stopping happn');

          if (typeof options === 'function') {
            stopCB = options;
            options = {};
          }

          if (options.kill && !options.wait)
            options.wait = 10000;

          var kill = function () {
            process.exit(options.exitCode || 1);
          }

          if (options.kill) {
            setTimeout(function () {
              log.error('failed to stop happn, force true');
              kill();
            }, options.wait);
          }

          async.eachSeries(Object.keys(happn.services),
            function (serviceName, stopServiceCB) {
              var serviceInstance = happn.services[serviceName];

              if (serviceInstance.stop) {
                serviceInstance.stop(options, stopServiceCB);
              }
              else
                stopServiceCB();

            },
            function (e) {

              if (e)
                return stopCB(e); // not stopping network

              //drop all connections
              happn.dropConnections();
              log.$$DEBUG('stopped services');

              stopCB();
            }
          );
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

        if (config.port == undefined || config.port == null)
          config.port = 55000;

        instance.__happn = happn;

        instance.__happn.__defaultHost = config.host == null ? '0.0.0.0' : config.host;
        instance.__happn.__defaultPort = config.port;

        if (!config.deferListen)
          instance.__happn.listen(done);
        else {
          done(null, instance.__happn);
        }

      });
    });
  })
}
