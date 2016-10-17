describe('e1_listen_retry', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service1 = happn.service;
  var service2 = happn.service;

  var async = require('async');

  var service1Port = 8000;
  var service2Port = 8000;

  var instances = [];

  var stopInstances = function(callback){

    if (instances.length == 0) return callback();

    async.eachSeries(instances, function (instance, eachCallback) {
        instance.stop(eachCallback);
      },
      function(e){
        if (e) return callback(e);
        instances = [];
        callback();
      }
    );
  };

  after('stop all services', function (callback) {
    stopInstances(callback);
  });

  var initializeService = function (instance, port, callback) {
    instance.initialize({
      port: port,
      deferListen:true
    },
    function (e, instance) {
      if (e) return callback(e);

      instances.push(instance);
      callback();
    }
    );
  };

  it('should initialize the services on the same port, then stop a service to allow the other to succeed when the port is available', function (callback) {

    this.timeout(20000);

    try {

      initializeService(service1, service1Port, function (e) {

        if (e) return callback(e);

        initializeService(service2, service2Port, function (e) {

          if (e) return callback(e);

          instances[0].listen(function(e){

            if (e) return callback(e);

            instances[1].listen(function(e){

              if (e) return callback(e);
              callback();
            });

            setTimeout(function(){
              instances[0].stop();
            }, 3000);
          })
        });
      });

    } catch (e) {
      callback(e);
    }
  });

  require('benchmarket').stop();

});
