var async = require('async'),
    connect = require('connect'),
    cookies = require('connect-cookies'),
    utils = require('./utils'),
    serveStatic = require('serve-static'),
    shortid = require('shortid'),
    Logger = require('happn-logger'),
    transport = require('./transport'),
    Crypto = require('happn-util-crypto'),
    crypto = new Crypto()
    ;

module.exports = {
  initialize:function(config, done){
    console.warn('use of initialize when creating happn service is deprecated. use happn.service.create');
    return this.create(config, done);
  },
  listen: utils.promisify(function(address, port, done){

    if (this.__listening) return done(new Error('already listening'));
    if (!this.__initialized) return done(new Error('not initialized'));

    var _this = this;

    if (typeof address == 'function'){
      done = address;
      address = null;
      port = null;
    }

    if (typeof port == 'function'){
      done = port;
      port = null;
    }

    if (address == null)
        address = _this.__address;

    if (port == null)
        port = _this.__port;

    if (!address)
        address = '127.0.0.1';

    if (!port)
        port = 55000;

    _this.__done = done;//kind of singleton, damn rigmarole because the listen callback doesn't respond

    if (!_this.__errorOn){
      this.__happn.server.on('error', function(e) {

        _this.__happn.server.lastError = e;
        if (_this.__done) {
          // Error before listening achieved
          //
          // eg. EADDRINUSE
          //
          _this.__done(e, _this.__happn);
          _this.__done = null;
        }

      });
      _this.__errorOn = true;
    }

    if (!_this.__listeningOn){
      this.__happn.server.on('listening', function() {

        _this.__info = _this.__happn.server.address();

        // the normal case for listening
        _this.__listening = true;
        _this.__happn.log.info('listening at ' + _this.__info.address + ':' + _this.__info.port);
        _this.__happn.log.info('happn version ' + require('../package.json').version);

        _this.__done(null, _this.__happn); // <--- good, created a happn
        _this.__done = null;
      });
      _this.__listeningOn = true;
    }

    _this.__happn.log.$$TRACE('listen()');
    _this.__happn.server.listen(this.__port, this.__host);

  }),
  create: utils.promisify(function(config, done){
    var _this = this;

    if (typeof config == 'function'){
      done = config;
      config = {};
    }

    // preserve zero as valid port number
    var port = typeof config.port !== 'undefined' ? config.port : 55000;
    //nulls arent provided for in the above
    if (port == null) port = 55000;

    if (!config.utils){
      config.utils = {
        logLevel: 'info'
      }
    }

    var host = config.host?config.host:'0.0.0.0';

    if (!config.utils.Logger && !Logger.configured) {
      Logger.configure(config.utils);
    }

    var log = (config.utils.Logger || Logger).createLogger('HappnServer');
    log.context = config.name;

    var happn = {
      services:{},
      config:config,
      log:log,
      connections:{}
    };

    var app = connect();

    app.use(serveStatic(__dirname + '/public'));
    var bodyParser = require('body-parser')
    app.use(bodyParser.json());
    app.use(cookies());

    var loadMiddleware = function(middleware_name){
      log.$$TRACE('loadMiddleware( ' + middleware_name);

        var middleware = require('./middleware/' + middleware_name);

        middleware.happn = happn;
        app.use(middleware.process.bind(middleware));

        if (middleware['process_error'])
          app.use(middleware.process_error.bind(middleware));

        if (middleware['initialize']){
          if (config.middleware) middleware.initialize(config.middleware[middleware_name]);
          else middleware.initialize();
        }
    };

    crypto.attacheMiddleware(app, '/browser_crypto.js');

    loadMiddleware('client');
    loadMiddleware('security');

    happn.utils = utils;
    happn.connect = app;

    _this.__listening = false;
    _this.__erroredOnStart = false;

    transport.createServer(config.transport, app, log, function(e, server){

      if (e) return done(e);

      happn.server = server;

      Object.defineProperty(happn.server, 'listening', {
        get: function() {
          return _this.__listening;
        },
        enumerable: 'true'
      });

      happn.server.on('connection', function(conn) {
        var key = conn.remoteAddress + ':' + conn.remotePort;
        happn.connections[key] = conn;
        conn.on('close', function() {
          delete happn.connections[key];
        });
      });

      happn.server.on('error', function(e) {
        log.warn('server error', e);
      });

      happn.server.on('close', function(msg) {
        log.info('released ' + _this.__info.address + ':' + _this.__info.port);
      })

      require('./services').initialize(config, happn, log, function(e){

        if (e){
          log.fatal('Failed to initialize services', e);
          return done(e);
        }

        //how we collect stats from the various services and return them as a json object
        happn.stats = function(opts){

          var stats = {};

          if (!opts)
            opts = {};

          for (var serviceName in happn.services){
            stats[serviceName] = {};

            if (happn.services[serviceName].stats)
              stats[serviceName] = happn.services[serviceName].stats(opts[serviceName]);
          }

          return stats;

        }

        happn.stop = utils.promisify(function(options, stopCB){
        //happn.stop = function(options, stopCB){

          log.$$DEBUG('stopping happn');

          if (typeof options === 'function'){
            stopCB = options;
            options = {};
          }

          if (options.kill && !options.wait)
            options.wait = 10000;

          var kill = function(){
             process.exit(options.exitCode || 1);
          }

          if (options.kill){
            timeout = setTimeout(function(){
              log.error("failed to stop happn, force true");
              kill();
            }, options.wait);
          }

          async.eachSeries(Object.keys(happn.services),
            function(serviceName, stopServiceCB) {
              var serviceInstance = happn.services[serviceName];

              if (serviceInstance.stop){
                serviceInstance.stop(options, stopServiceCB);
              }
              else
                stopServiceCB();

            },
            function(e) {

              if (e)
                return stopCB(e); // not stopping network

              //drop all connections
              for (var key in happn.connections)
                happn.connections[key].destroy();

              log.$$TRACE('killed connections');
              log.$$DEBUG('stopped services');

              ///// primus closes the http server
              ///// see primus.destroy() in services/pubsub/service
              // happn.server.close(function(e) {
              //   log.$$TRACE('closed http server', arguments);
              //   if (e) {
              //     log.error('error on server stop()', e);
              //     return stopCB(e);
              //   }
              //   log.info('released ' + info.address + ':' + info.port);
              //   stopCB();
              // });
              stopCB();
            }
          );
        });

        _this.__port = port;
        _this.__host = host;
        _this.__happn = happn;
        _this.__config = config;
        _this.__initialized = true;

        if (!config.deferListen)
           _this.listen(done);
        else{
          _this.__happn.listen = _this.listen.bind(_this);
          done(null, _this.__happn);
        }

      });

    });

  })
}
