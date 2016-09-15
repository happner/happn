describe('e1_pubsub_middleware_unit', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index');

  var service = happn.service;
  var async = require('async');

  var Crypto = require('happn-util-crypto');
  var crypto = new Crypto();

  it('tests the __initializeMiddeware function for pubsub', function (done) {

    var PubSubService = require('../lib/services/pubsub/service');
    var Logger = require('happn-logger');

    var pubsubService = new PubSubService({logger: Logger});

    var registeredCount = 0;

    pubsubService.primus = {
      transform:function(direction, transformer){
        registeredCount++;

        if (registeredCount == 4) done();
      }
    };

    var config = {

      transformMiddleware:[
        {path:'./transform-payload-encryption'},
        {path:'./transform-message-protocol'},
        {path:'./transform-message-spy'},
        {instance:{
          incoming:function(){},
          outgoing:function(){},
          initialize:function(config, cb){
            expect(this.__pubsub).to.not.be(undefined);
            cb();
          }
        }}
      ]

    };

    pubsubService.__initializeTransformMiddleware(config, function(e){

      if (e) return done(e);

    });
  });

  it('tests the __initializeMiddeware function init failed for pubsub', function (done) {

    var PubSubService = require('../lib/services/pubsub/service');
    var Logger = require('happn-logger');

    var pubsubService = new PubSubService({logger: Logger});

    pubsubService.primus = {
      transform:function(direction, transformer){}
    };

    var config = {

      transformMiddleware:[
        {path:'./transform-payload-encryption'},
        {path:'./transform-message-protocol'},
        {path:'./transform-message-spy'},
        {instance:{
          incoming:function(){},
          outgoing:function(){},
          initialize:function(config, cb){
            cb(new Error('init failed for test transformer'))
          }
        }}
      ]

    };

    pubsubService.__initializeTransformMiddleware(config, function(e){

      if (!e) return done(new Error('this was not meant to happn'));

      expect(e.toString()).to.be('Error: init failed for test transformer');

      done();

    });
  });

  it('tests the protocol transformer', function (done) {
    var ProtocolTransformer = require('../lib/services/pubsub/transform-message-protocol');
    var protocolTransformer = new ProtocolTransformer();

    var packet = {
      data:{}
    };

    protocolTransformer.initialize({}, function(e){
      if (e) return done(e);

      protocolTransformer.outgoing(packet, function(e){

        if (e) return done(e);
        expect(packet.data.headers.protocol).to.be('1.0.0');

        done();

      });
    });
  });

  it('tests the message spy transformer', function (done) {

    var MessageSpyTransformer = require('../lib/services/pubsub/transform-message-spy');
    var messageSpyTransformer = new MessageSpyTransformer();

    var packet = {
      data:{
        data:{
          test:3
        }
      }
    };

    var loggedCount = 0;

    messageSpyTransformer.initialize({

      log:function(direction, packet){

        expect(packet.data.data.test).to.be(3);

        expect(['incoming','outgoing'].indexOf(direction) > -1).to.be(true);

        loggedCount++;

        if (loggedCount == 2) return done();
      }

    }, function(e){

      if (e) return done(e);

      messageSpyTransformer.incoming(packet, function(e){

        if (e) return done(e);

        messageSpyTransformer.outgoing(packet, function(e){

          if (e) return done(e);

        });
      });
    });

  });

  it('tests the message encryption transformer', function (done) {

    var PayloadEncryptionTransformer = require('../lib/services/pubsub/transform-payload-encryption');
    var payloadEncryptionTransformer = new PayloadEncryptionTransformer();

    var Crypto = require('happn-util-crypto');
    var crypto = new Crypto();

    var SECRET = "TEST_SECRET";

    var packet = {
      data:{}
    };

    packet.data.encrypted = crypto.symmetricEncryptObject({
      data:{test:"ok"},
      _meta:{
        sessionId:100
      }
    }, SECRET);

    payloadEncryptionTransformer.__pubsub = {

      getSession:function(id){
        return {
          secret:SECRET
        }
      },

      happn:{
        services:{
          crypto:{

            symmetricEncryptObject: function(data, secret){
              return crypto.symmetricEncryptObject(data, secret);
            },

            symmetricDecryptObject: function(data, secret){
              return crypto.symmetricDecryptObject(data, secret);
            }
          }
        }
      }

    };

    payloadEncryptionTransformer.incoming(packet, function(e){

      if (e) return done(e);

      expect(packet.data.data.test).to.be("ok");

      payloadEncryptionTransformer.outgoing(packet, function(e){

        if (e) return done(e);

        expect(packet.data.encrypted).to.not.be(undefined);
        expect(packet.data.encrypted).to.not.be(null);

        done();

      });
    });

  });

  require('benchmarket').stop();
});
