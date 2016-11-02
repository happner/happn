var async = require('async');

function ServiceManager(){

}

ServiceManager.prototype.initialize = function (config, happn, callback) {

  this.happn = happn;

  if (!config.services) config.services = {};

  if (!config.services.system) config.services.system = {};

  if (!config.services.system.config) config.services.system.config = {};

  if (config.name) config.services.system.config.name = config.name;

  var loadService = function (serviceName, service, serviceLoaded) {

    happn.log.$$TRACE('loadService( ' + serviceName);

    var ServiceDefinition, serviceInstance;

    if (!service.instance) {
      try {

        if (!service.path) service.path = './' + serviceName + '/service';

        ServiceDefinition = require(service.path);

        serviceInstance = new ServiceDefinition({logger: happn.log});

      } catch (e) {
        happn.log.error('Failed to instantiate service: ' + serviceName, e);
      }
    } else serviceInstance = service.instance;

    serviceInstance.happn = happn;
    happn.services[serviceName] = serviceInstance;

    if (!service.config) service.config = {};

    if (config.secure) service.config.secure = true;

    if (serviceInstance['initialize']) serviceInstance.initialize(service.config, serviceLoaded);
    else serviceLoaded();

  };

  var _this = this;
  _this.__loaded = [];

  async.eachSeries(
    [
      'utils',
      'error',
      'log',
      'data',
      'system',
      'cache',
      'connect',
      'crypto',
      'transport',
      'session',
      'protocol',
      'security',
      'pubsub',
      'queue',
      'layer',
      'stats'
    ],
    function (serviceName, loadServiceCB) {

      if (!config.services[serviceName]) config.services[serviceName] = {};
      if (!config.services[serviceName].path) config.services[serviceName].path = './' + serviceName + '/service.js';
      if (!config.services[serviceName].config) config.services[serviceName].config = {};

      loadService(serviceName, config.services[serviceName], function (e) {
        if (e) return loadServiceCB(e);

        happn.log.info(serviceName + ' service loaded.');
        _this.__loaded.push(serviceName);
        loadServiceCB();

      });
    },
    callback);
};

ServiceManager.prototype.stop = function(options, callback){

  var _this = this;

  if (typeof options === 'function'){
    callback = options;
    options = {};
  }

  if (options.kill && !options.wait) options.wait = 10000;

  var kill = function () {
    process.exit(options.exitCode || 1);
  };

  if (options.kill) {
    setTimeout(function () {
      _this.happn.services.log.error('failed to stop happn, force true');
      kill();
    }, options.wait);
  }

  //we stop everything in reverse, that way primus (session service) is able to say goodbye properly before transport service
  async.eachSeries(_this.__loaded.reverse(),

    function (serviceName, stopServiceCB) {

      var serviceInstance = _this.happn.services[serviceName];

      if (serviceInstance.stop) serviceInstance.stop(options, stopServiceCB);

      else stopServiceCB();
    },
    callback
  );
};

module.exports = ServiceManager;
