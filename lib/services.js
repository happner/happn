var async = require('async');

module.exports = {

  initialize: function (config, happn, log, callback) {

    if (!config.services) config.services = {};

     //backward compatability, based on new options

    if (!config.services.crypto) {
      config.services.crypto = {
        path: './services/crypto/service.js',
        config: {}
      }
    }

    if (config.services.auth) {

      if (config.services.auth.path == './services/auth/service.js') config.services.auth.path = './services/security/service.js';

      config.services.security = config.services.auth;
      delete config.services.auth;
    }

    if (!config.services.security) {
      config.services.security = {
        path: './services/security/service.js'
      }
    }

    //backward compatability
    if (config.services.data && config.services.data.path == './services/data_embedded/service.js') config.services.data.path = './services/data/service.js';

    if (!config.services.data) {
      config.services.data = {
        path: './services/data/service.js',
        config: {}
      }
    }

    if (!config.services.pubsub) {
      config.services.pubsub = {
        path: './services/pubsub/service.js',
        config: {}
      }
    }

    if (!config.services.system) {
      config.services.system = {
        path: './services/system/service.js',
        config: {}
      }
    }

    if (config.name) config.services.system.config.name = config.name;

    if (!config.services.pubsub.config) config.services.pubsub.config = {};

    if (config.secure) config.services.pubsub.config.secure = true;

    var loadService = function (serviceName, service, serviceLoaded) {
      log.$$TRACE('loadService( ' + serviceName);

      var ServiceDefinition, serviceInstance;

      if (!service.instance) {
        try {

          if (!service.path)
            service.path = './services/' + serviceName + '/service';

          ServiceDefinition = require(service.path);

          serviceInstance = new ServiceDefinition({logger: log});

        } catch (e) {
          log.error('Failed to instantiate service: ' + serviceName, e);
        }
      } else
        serviceInstance = service.instance;

      serviceInstance.happn = happn;
      happn.services[serviceName] = serviceInstance;

      if (!service.config) service.config = {};

      if (serviceInstance['initialize']) {
        serviceInstance.initialize(service.config, serviceLoaded);
      } else {
        serviceLoaded();
      }
    };

    async.eachSeries(['crypto', 'data', 'system', 'security', 'pubsub'],
      function (serviceName, loadServiceCB) {
        var service = config.services[serviceName];

        loadService(serviceName, service, function (e) {
          if (e) return loadServiceCB(e);

          log.info(serviceName + ' service loaded.');
          loadServiceCB();

        });
      },
      callback);
  }
}
