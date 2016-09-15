describe('e2_pubsub_middleware_sanity', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;

  var serviceInstance;
  var clientInstance;

  var disconnectClient = function(callback){
    if (clientInstance)
      clientInstance.disconnect(callback);
    else
      callback();
  };

  var stopService = function(callback){
    if (serviceInstance)
      serviceInstance.stop(callback);
    else
      callback();
  };

  after('disconnects the client and stops the server', function(callback){

    this.timeout(3000);

    disconnectClient(function(){
      stopService(callback);
    });

  });

  var getService = function(middleware, callback){

    disconnectClient(function(e){

      if (e) return callback(e);

      stopService(function(e){

        if (e) return callback(e);

        var serviceConfig = {
          secure: true,
          port:44444,
          services:{
            pubsub:{
              config:{
                transformMiddleware:middleware
              }
            }
          }
        };

        service.create(serviceConfig,
          function (e, happnInst) {
            if (e)
              return callback(e);

            serviceInstance = happnInst;

            happn_client.create({
              config: {
                port:44444,
                username: '_ADMIN',
                password: 'happn'
              },
              info:{
                from:'startup'
              }
            }, function (e, instance) {

              if (e) return callback(e);

              clientInstance = instance;

              callback();

            });
          }
        );
      });
    });
  };

  it('tests injecting spy middleware into the pubsub service, as an instance', function (callback) {

    this.timeout(6000);

    var Spy = require('../lib/services/pubsub/transform-message-spy');
    var spy = new Spy();

    var packetsIn = [];
    var packetsOut = [];

    var spyConfig = {

      suppressPrint:true,

      log:function(direction, packet){

        if (direction == 'incoming') packetsIn.push(packet);
        if (direction == 'outgoing') packetsOut.push(packet);

      }
    };

    getService([{instance:spy, options:spyConfig}], function(e){

      var RandomActivityGenerator = require("happn-random-activity-generator");
      var randomActivity1 = new RandomActivityGenerator(clientInstance);

      randomActivity1.generateActivityStart("test", function () {

        setTimeout(function () {

          randomActivity1.generateActivityEnd("test", function (aggregatedLog) {

            expect(packetsIn.length > 0).to.be(true);
            expect(packetsOut.length > 0).to.be(true);

            callback();

          });
        }, 3000);
      });
    });
  });

  it('tests injecting spy middleware into the pubsub service, as a path', function (callback) {

    this.timeout(6000);

    var packetsIn = [];
    var packetsOut = [];

    var spyConfig = {

      suppressPrint:true,//make this

      log:function(direction, packet){

        if (direction == 'incoming') packetsIn.push(packet);
        if (direction == 'outgoing') packetsOut.push(packet);

      }
    };

    getService([{path:'./transform-message-spy', options:spyConfig}], function(e){

      var RandomActivityGenerator = require("happn-random-activity-generator");
      var randomActivity1 = new RandomActivityGenerator(clientInstance);

      randomActivity1.generateActivityStart("test", function () {

        setTimeout(function () {

          randomActivity1.generateActivityEnd("test", function (aggregatedLog) {

            expect(packetsIn.length > 0).to.be(true);
            expect(packetsOut.length > 0).to.be(true);

            callback();

          });
        }, 3000);
      });
    });
  });

  it('tests injecting arbitrary middleware into the pubsub service, as an instance', function (callback) {

    var testMiddleware = {

      incomingCount:0,
      outgoingCount:0,

      incoming:function(packet, next){
        //modify incoming packet here
        packet.modified = true;
        this.incomingCount++;
        next();
      },

      outgoing:function(packet, next){
        //modify outgoing packet here
        packet.modified = true;
        this.outgoingCount++;
        next();
      }
    };

    var happn_service = happn.service;
    var test_client = happn.client;

    var testConfig = {
      secure: true,
      port:44445,
      services:{
        pubsub:{
          config:{
            transformMiddleware:[{instance:testMiddleware}]//middelware added in the order it is required to run in
                                                          // either as an instance or as a path {path:'my-middleware-module'}
                                                          // path style middlewares are instantiated using require and new
          }
        }
      }
    };

    service.create(testConfig,

      function (e, happnInst) {
        if (e)
          return callback(e);

        serviceInst = happnInst;

        happn_client.create({
          config: {
            port:44445,
            username: '_ADMIN',
            password: 'happn'
          },
          info:{
            from:'startup'
          }
        }, function (e, instance) {

          if (e) return callback(e);

          clientInst = instance;

          //the login of the client generated traffic
          expect(testMiddleware.incomingCount > 0).to.be(true);
          expect(testMiddleware.outgoingCount > 0).to.be(true);

          clientInst.disconnect(function(){
            serviceInst.stop(callback);
          });
        });
      }
    );

  });


  require('benchmarket').stop();

});
