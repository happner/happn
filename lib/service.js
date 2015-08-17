var cluster = require('cluster'),
    async = require('async'),
    http      = require('http'),
    connect = require('connect'),
    utils = require('./utils'),
    serveStatic = require('serve-static');


module.exports = {
  initialize:function(config, done){
    
    var port = config.port?config.port:8000;


    if (!config.utils){
      config.utils = {
        log_level:'info|error|warning',
        log_component:'prepare'
      }
    }
  
    var host = config.host?config.host:'127.0.0.1';

    utils.initialize(config.utils);

    var initializeWorker = function(){
     
      var happn = {services:{}, config:config};
      var app = connect();
      
      //////console.log(__dirname)
      app.use(serveStatic(__dirname + '/public'));

      var bodyParser = require('body-parser')
      app.use(bodyParser.json());
     
      //////console.log('have public');

      var loadMiddleware = function(middleware_name){

         ////////////console.log('loading middleware ' + middleware_name);
          var middleware = require('./middleware/' + middleware_name);
          
          middleware.happn = happn;
          app.use(middleware.process.bind(middleware));

          if (middleware['process_error'])
            app.use(middleware.process_error.bind(middleware));

      };

      loadMiddleware('proxy');
      loadMiddleware('client');
    
      happn.utils = utils;
      happn.connect = app;
      happn.server = http.createServer(app);

      if (!config.services) config.services = {};

      if (!config.services.auth){
        config.services.auth = {
          path:'./services/auth/service.js',
          config:{
            authTokenSecret:'a256a2fd43bf441483c5177fc85fd9d3',
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

       if (!config.services.proxy){
        config.services.proxy = {
          path:'./services/proxy/service.js',
          config:{}
        }
      }

      if (!config.services.pubsub){
        config.services.pubsub = {
          path:'./services/pubsub/service.js',
          config:{
            enableProxy:true
          }
        }
      }

      var loadService = function(serviceName, service, serviceLoaded){

        var serviceInstance;

        if (!service.instance){
          try{

            if (!service.path)
              service.path = './services/' + serviceName;

            serviceInstance = require(service.path);

          }catch(e){
            utils.log('Failed to instantiate service: ' + serviceName, 'error');
            utils.log(e, 'error');
          }
        }else
          serviceInstance = service.instance;

        
        serviceInstance.happn = happn;
        happn.services[serviceName] = serviceInstance;

        if (serviceInstance['initialize']){

          if (!service.config)
            service.config = {};

          serviceInstance.initialize(service.config, function(e){
            serviceLoaded(e);
          });

        }else{
          serviceLoaded();
        }
      }

      async.eachSeries(Object.keys(config.services), function(serviceName, callback) {
        var service = config.services[serviceName];
        
        loadService(serviceName, service, callback);
      }, 
      function(err){
          if (err){

            utils.log('Failed to initialize services', 'error');
            utils.log(err, 'error');

            process.exit(1);
          }
      });

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

      return happn;
    }

    try{
      var happn = initializeWorker();
      done(null, happn);
    }catch(e){
      done(e);
    }
  }
}
