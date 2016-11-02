var Logger = require('happn-logger')
  , Services = require('./services/manager')
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

    var services = new Services();

    happn.stop = Promise.promisify(function (options, stopCB) {

      if (!instance.__initialized) log.warn('not initialized yet, trying to stop services nevertheless');

      log.$$DEBUG('stopping happn');

      if (typeof options === 'function'){
        stopCB = options;
        options = {};
      }

      services.stop(options, function(e){

        if (e) return stopCB(e); // not stopping network

        log.$$DEBUG('stopped services');

        return stopCB();

      });
    });

    happn.listen = function(host, port, options, listenCB){

      if (typeof options === 'function'){
        listenCB = options;
        options = null;
      }

      if (!instance.__initialized) return listenCB(new Error('not initialized yet'));

      return happn.services.transport.listen(host, port, options, listenCB);
    };

    services.initialize(config, happn, function (e) {

      if (e) {
        console.log('Failed to initialize services', e);
        return done(e);
      }

      instance.__config = config;
      instance.__initialized = true;

      Object.defineProperty(happn, '__factory', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: instance
      });

      if (config.port == undefined || config.port == null) config.port = 55000;

      instance.__happn = happn;

      instance.__happn.__defaultHost = config.host == null ? '0.0.0.0' : config.host;
      instance.__happn.__defaultPort = config.port;

      if (!config.deferListen) instance.__happn.listen(done);
      else done(null, instance.__happn);

    });
  })
};
