describe('d8_session_management', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var async = require('async');

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

  xit('tests the protocol transformer', function (done) {

  });

  xit('tests the message spy transformer', function (done) {

  });

  xit('tests the message encryption transformer', function (done) {

  });

  require('benchmarket').stop();
});
