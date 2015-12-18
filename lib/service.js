var async = require('async'),
    http      = require('http'),
    connect = require('connect'),
    utils = require('./utils'),
    serveStatic = require('serve-static'),
    Promise = require('bluebird'),
    shortid = require('shortid'),
    Logger = require('happn-logger')
    ;

var Promisify = function(originalFunction, opts) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    var _this = this;

    if (opts && opts.unshift) args.unshift(opts.unshift);

    // No promisify if last passed arg is function (ie callback)

    if (typeof args[args.length - 1] == 'function') {
      return originalFunction.apply(this, args);
    }

    return new Promise(function(resolve, reject) {
      // push false callback into arguments
      args.push(function(error, result, more) {
        if (error) return reject(error);
        if (more) {
          var args = Array.prototype.slice.call(arguments);
          args.shift(); // toss undefined error
          return resolve(args); // resolve array of args passed to callback
        }
        return resolve(result);
      });
      try {
        return originalFunction.apply(_this, args);
      } catch (error) {
        return reject(error);
      }
    });
  }
}

module.exports = {
  initialize:function(config, done){
    console.warn('use of initialize when creating happn service is deprecated. use happn.service.create');
    return this.create(config, done);
  },
  create: Promisify(function(config, done){
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

    var loadMiddleware = function(middleware_name){
      log.$$TRACE('loadMiddleware( ' + middleware_name);

        var middleware = require('./middleware/' + middleware_name);
        
        middleware.happn = happn;
        app.use(middleware.process.bind(middleware));

        if (middleware['process_error'])
          app.use(middleware.process_error.bind(middleware));
    };

    loadMiddleware('client');
  
    happn.utils = utils;
    happn.connect = app;
    happn.server = http.createServer(app);

    var listening = false;
    var erroredOnStart = false;

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

    happn.server.on('listening', function() {

      var info = happn.server.address();

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

    if (!config.services) config.services = {};

    /*
      backward compatability
    */
    if (config.services.auth){

      if (config.services.auth.path == './services/auth/service.js')
        config.services.auth.path = './services/security/service.js';

      config.services.security = config.services.auth;
      delete config.services.auth;
    }
    
    if (!config.services.security){
      config.services.security = {
        path:'./services/security/service.js'
      }
    }

    if (!config.services.data){
      config.services.data = {
        path:'./services/data_embedded/service.js',
        config:{}
      }
    }

    if (!config.services.pubsub){
      config.services.pubsub = {
        path:'./services/pubsub/service.js',
        config:{}
      }
    }

     if (!config.services.system){
      config.services.system = {
        path:'./services/system/service.js',
        config:{}
      }
    }

    if (config.name)
      config.services.system.config.name = config.name;

    if (!config.services.pubsub.config)
      config.services.pubsub.config = {};

    if (config.secure)
      config.services.pubsub.config.secure = true;

    var loadService = function(serviceName, service, serviceLoaded){
      log.$$TRACE('loadService( ' + serviceName);

      var ServiceDefinition, serviceInstance;

      if (!service.instance){
        try{

          if (!service.path)
            service.path = './services/'+serviceName+'/service';

          ServiceDefinition = require(service.path);

          serviceInstance = new ServiceDefinition({logger: log});

        }catch(e){
          log.error('Failed to instantiate service: ' + serviceName, e);
        }
      }else
        serviceInstance = service.instance;
      
      serviceInstance.happn = happn;
      happn.services[serviceName] = serviceInstance;

      if (!service.config)
        service.config = {};

      if (serviceInstance['initialize']){
        serviceInstance.initialize(service.config, serviceLoaded);
      }else{
        serviceLoaded();
      }
    }

    async.eachSeries(['data', 'system', 'security', 'pubsub'], 
      function(serviceName, loadServiceCB) {
        var service = config.services[serviceName];
      
        loadService(serviceName, service, function(e){
          if (e) return loadServiceCB(e);

          log.info(serviceName + ' service loaded.');
          loadServiceCB();

        });
      }, 
      function(err){

        if (err){
          log.fatal('Failed to initialize services', err);
          return done(err);
        }

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

        happn.stop = Promise.promisify(function(options, stopCB){
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

              if (serviceInstance.stop)
                serviceInstance.stop(options, stopServiceCB);
              else
                stopServiceCB();

            },
            function(e) {

              // some services might not have stopped.

              if (e) return stopCB(e); // not stopping network

              // stop the server
              log.$$DEBUG('stopped services');
              var info = happn.server.address();

              for (var key in happn.connections)
                happn.connections[key].destroy();

              log.$$TRACE('killed connections');
              // log.$$TRACE('killed connections', _this.connections); // Too long
              // log.$$TRACE('killed connections', Object.keys(_this.connections)); // Too expensive

              happn.server.close(function(e) {

                log.$$TRACE('closed http server', arguments);

                if (e) {
                  log.error('error on server stop()', e);
                  return stopCB(e);
                }

                log.info('released ' + info.address + ':' + info.port);
                stopCB();
              });
            }
          );
        });

        log.$$TRACE('listen()');
        happn.server.listen(port, host);

      }
    );
  })
}
