var async = require('async'),
    http      = require('http'),
    connect = require('connect'),
    utils = require('./utils'),
    serveStatic = require('serve-static'),
    shortid = require('shortid');

module.exports = {
  stop:function(options, done){
    this.happn.stop(options, done);
  },
  initialize:function(config, done){
    console.warn('use of initialize when creating happn service is deprecated. use happn.service.create');
    this.create(config, done);
  },
  create:function(config, done){
    
    var port = config.port?config.port:55000;
    var _this = this;

    if (!config.utils){
      config.utils = {
        logLevel: 'info'
      }
    }
  
    var host = config.host?config.host:'127.0.0.1';

    utils.initialize(config.utils);

    var log = utils.createLogger('HappnServer');

    // log.$$TRACE('message');
    // log.$$DEBUG('message');
    // log.info('message');
    // log.warn('message');
    // log.error('message');
    // log.fatal('message');

    var happn = {services:{},config:config};
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

    if (!config.services.auth){
      config.services.auth = {
        path:'./services/auth/service.js',
        config:{
          authTokenSecret:shortid.generate(),
          systemSecret:'happn'
        }
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

    var loadService = function(serviceName, service, serviceLoaded){
      log.$$TRACE('loadService( ' + serviceName);

      var ServiceDefinition, serviceInstance;

      if (!service.instance){
        try{

          if (!service.path)
            service.path = './services/' + serviceName;

          ServiceDefinition = require(service.path);

          serviceInstance = new ServiceDefinition();

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

    async.eachSeries(Object.keys(config.services), 
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

        log.$$TRACE('listen()');
        happn.server.listen(port, host);

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

        }.bind(happn);

        happn.stop = function(options, stopCB){
          log.$$DEBUG('stopping');
         
          if (typeof options === 'function')
            stopCB = options;
          else if (!options)
            options = {};

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

              var info = happn.server.address();

              happn.server.close(function(e) {

                if (e) {
                  log.error('error on server stop()', e);
                  return stopCB(e);
                }

                log.info('released ' + info.address + ':' + info.port);
                stopCB();
              });
            }
          );
  
        }.bind(happn)
        
        _this.happn = happn;

        // moved callback into on('listening', ...)
        // so that it only happens on success.

        // done(null, happn);

      }
    );
  }
}
