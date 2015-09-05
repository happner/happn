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

    var happn = {services:{}, config:config};
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

    happn.server.on('listening', function() {

      log.info('listening at ' + host+':'+port);
      done(null, happn);

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

      var serviceInstance;

      if (!service.instance){
        try{

          if (!service.path)
            service.path = './services/' + serviceName;

          serviceInstance = require(service.path);

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
          var _this = this;
          _this.server.close();
         
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

          async.eachSeries(Object.keys(_this.services), 
            function(serviceName, stopServiceCB) {
              var serviceInstance = _this.services[serviceName];

              if (serviceInstance.stop)
                serviceInstance.stop(options, stopServiceCB);
              else
                stopServiceCB();

            },
            stopCB
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
