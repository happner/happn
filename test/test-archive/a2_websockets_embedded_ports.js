var expect = require('expect.js');
var happn = require('../lib/index')
var service1 = happn.service;
var service2 = happn.service;
var serviceDefault = happn.service;

var happn_client = happn.client;
var async = require('async');

describe('a2_websockets_embedded_ports', function () {

  var service1Port = 8000;
  var service2Port = 8001;

  var service1Client;
  var service2Client;
  var defaultClient;

  var mode = "embedded";

  var default_timeout = 4000;

  var instances = [];

  after('stop all services', function (callback) {

    async.eachSeries(instances, function (instance, eachCallback) {
        instance.stop(eachCallback);
      },
      callback
    );

  });

  var initializeService = function (instance, port, callback) {
    instance.initialize({port: port},
      function (e, instance) {
        if (e) return callback(e);

        instances.push(instance);
        callback();
      }
    );
  }

  it('should initialize the services', function (callback) {

    this.timeout(20000);

    try {

      initializeService(service1, service1Port, function (e) {
        if (e) return callback(e);

        initializeService(service2, service2Port, function (e) {
          if (e) return callback(e);

          initializeService(serviceDefault, null, callback);
        });
      });

    } catch (e) {
      callback(e);
    }
  });

  var device1client;// a client that is connecting to the device 1
  var device2client;// a client that is connecting to the device 2
  var gatewayclient;// a client that connects to the gateway for services on the gateway (non proxied requests)

  it('should initialize the clients', function (callback) {
    this.timeout(default_timeout);

    try {
      //plugin, config, context, 

      happn_client.create({config: {port: service1Port}}, function (e, instance) {

        if (e) return callback(e);

        service1Client = instance;

        console.log('have service1Client:::');

        happn_client.create({config: {port: service2Port}}, function (e, instance) {

          if (e) return callback(e);

          service2Client = instance;

          console.log('have service2Client:::');

          happn_client.create({config: {port: 55000}}, function (e, instance) {

            if (e) return callback(e);

            defaultClient = instance;

            console.log('have defaultClient:::');

            callback();

          });
        });

      });

    } catch (e) {
      callback(e);
    }
  });


});
