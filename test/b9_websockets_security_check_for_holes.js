
var happn = require('../lib/index');
var serviceInstance;
var expect = require('expect.js');
var test_id = Date.now() + '_' + require('shortid').generate();

describe('b8_check_for_holes', function() {

  var getService = function(config, callback){
   happn.service.create(config,
      callback
    );
  }

  var websocketsClient;
  var eventEmitterClient;

  before('it starts completely defaulted service, created a websockets client and an eventemiiter client', function(done){

    getService({secure:true}, function(e, service){

      if (e) return done(e);

      console.log('service up:::');

      serviceInstance = service;
     
      done();

    });

  });

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

  it('traverses the websocket clients object model to look for forbidden method signatures', function(done) {

    this.timeout(20000);

    var eve = require('traverse');

    var forbidden = ['__validate','_authorize', '_keyPair', '_checkpoint'];
    var apples = [];

      eve(websocketsClient).map(function(){

        if (forbidden.indexOf(this.key) >= 0)
          apples.push(this.path.join('.'));

      });

      if (apples.length > 0){
        console.log(apples);
        return done(new Error('found forbidden method signatures...'));
      }
       

      done();

  });

});
