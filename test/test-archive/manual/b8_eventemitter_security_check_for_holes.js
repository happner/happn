var happn = require('../../lib/index');
var serviceInstance;
var expect = require('expect.js');
var test_id = Date.now() + '_' + require('shortid').generate();
var HAPPNER_STOP_DELAY = 5000;

describe('b8_check_for_holes', function () {

  var getService = function (config, callback) {
    happn.service.create(config,
      callback
    );
  }

  var websocketsClient;
  var eventEmitterClient;

  before('it starts completely defaulted service, created a websockets client and an eventemiiter client', function (done) {

    getService({secure: true}, function (e, service) {

      if (e) return done(e);

      console.log('service up:::');

      serviceInstance = service;

      done();

    });

  });

  after('should delete the temp data file', function (callback) {

    this.timeout(HAPPNER_STOP_DELAY + 5000);

    serviceInstance.stop(function (e) {
      setTimeout(function () {
        callback(e);
      }, HAPPNER_STOP_DELAY)
    });

  });

  /*

   before('creates a ws client', function(done){

   happn.client.create({
   config:{username:'_ADMIN', password:'happn'},
   secure:true
   })

   .then(function(clientInstance){
   websocketsClient = clientInstance;

   console.log('ws client up:::');

   done();

   })

   });

   */

  before('creates an event emitter client', function (done) {

    happn.client.create({
        config: {username: '_ADMIN', password: 'happn'},
        plugin: happn.client_plugins.intra_process,
        context: serviceInstance,
        secure: true
      })

      .then(function (clientInstance) {
        eventEmitterClient = clientInstance;

        console.log('evt client up:::');

        done();

      })

  });

  it('traverses the event emitter clients object model to look for forbidden method signatures', function (done) {

    this.timeout(20000);

    var eve = require('traverse');

    var forbidden = ['__validate', '_authorize', '_keyPair', '_checkpoint'];
    var apples = [];

    eve(eventEmitterClient).map(function () {

      if (forbidden.indexOf(this.key) >= 0)
        apples.push(this.path.join('.'));

    });

    if (apples.length > 0) {
      console.log(apples);
      return done(new Error('found forbidden method signatures...'));
    }


    done();

  });

  xit('traverses the websockets clients object model to look for forbidden method signatures', function (done) {

    var adam = require('traverse');

    var forbidden = ['_remoteOff'];
    var apples = [];

    adam(eventEmitterClient).map(function () {

      if (forbidden.indexOf(this.key) >= 0)
        apples.push(this.path);

    });

    if (apples.length > 0)
      return done(new Error('found adams apple...'));

    done();

  });


});
