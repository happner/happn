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

    var listening = false;
    var erroredOnStart = false;

    transport.createServer(config.transport, app, log, function(e, server){

      if (e) return done(e);

      happn.server = server;

      Object.defineProperty(happn.server, 'listening', {
        get: function() {
          return listening;
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

      var info;
      happn.server.on('listening', function() {

        info = happn.server.address();

        if (erroredOnStart) {

          // Already called back with error.
          // But now it's successfully listening...

          if (happn.server.externalStarted) {

            // Outside has flagged that they started it
            // for a second go at attempting the socket

            listening = true;
            log.info('listening at ' + info.address + ':' + info.port);

            return;
          }

          // Outside did not start it after an error.

          log.warn('happn.server.externalStarted to silence this warning', new Error('Late to listen'));
          log.warn('listening (possibly with issues) at ' + info.address + ':' + info.port);
          return;

        }

        // the normal case for listening
        listening = true;
        log.info('listening at ' + info.address + ':' + info.port);
        log.info('happn version ' + require('../package.json').version);

        done(null, happn); // <--- good, created a happn

      });

      happn.server.on('error', function(e) {
        if (!happn.server.listening) {

          // Error before listening achieved
          //
          // eg. EADDRINUSE
          //
          done(e, happn); // <--- include happn in err,
                         //       might still be able to start it...
                        //
                       //     From the outside, eg.
                      //
                     //   Happn.service.create(function(e, happn) {
                     //          if (e) ...is EADDRINUSE
                     //             // use another port
                     //             happn.server.externalStarted = true;
                     //             happn.server.on('listening...', func);
                     //             happn.server.listen(++port);
                     //
                     //   })
                     //
                     //   - For micro devices and cpu-less-ness that
                     //     took ages to load up all the plugins and
                     //


          // Very slim chance! But something WEIRD could happn...
          // Prevent possible second callback if error occurs on socket
          // --------------------------------
          // before listen but then the socket still calls the listening
          // event.
          //
          // undone done...  (an opening salvo),  dah done, undone done
          //

          done = function() {/* and then there was no 'second callback' possible */};

          erroredOnStart = true;

          return;

          // At this point there is a bunch of middleware on the connect
          // app that is not going to get it's socket.

          // We could try with a new port number without having to
          // re-initialize everything.

        }

        log.warn('server error', e);

      });


      happn.server.on('close', function(msg) {
        log.info('released ' + info.address + ':' + info.port);
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

        log.$$TRACE('listen()');
        happn.server.listen(port, host);

      });

    });

  })
}
