var expect = require('expect.js');
var happn = require('../lib/index');
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

describe('a5_eventemitter_meta.js', function () {

  var testport = 8000;
  var test_secret = 'test_secret';
  var mode = "embedded";
  var default_timeout = 10000;
  var happnInstance = null;
  /*
   This test demonstrates starting up the happn service - 
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  after(function (done) {
    happnInstance.stop(done);
  });

  it('should initialize the service', function (callback) {

    this.timeout(20000);

    try {
      service.create({
          mode: 'embedded',
          services: {
            auth: {
              path: './services/auth/service.js',
              config: {
                authTokenSecret: 'a256a2fd43bf441483c5177fc85fd9d3',
                systemSecret: test_secret
              }
            },
            data: {
              path: './services/data_embedded/service.js',
              config: {}
            },
            pubsub: {
              path: './services/pubsub/service.js',
              config: {}
            }
          },
          utils: {
            log_level: 'info|error|warning',
            log_component: 'prepare'
          }
        },
        function (e, happn) {
          if (e)
            return callback(e);

          happnInstance = happn;
          callback();
        });
    } catch (e) {
      callback(e);
    }
  });


  var publisherclient;
  var listenerclient;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the 
   database whilst another listens for changes.
   */
  it('should initialize the clients', function (callback) {
    this.timeout(default_timeout);

    try {

      happn_client.create({
        plugin: happn.client_plugins.intra_process,
        context: happnInstance
      }, function (e, instance) {

        if (e) return callback(e);

        publisherclient = instance;

        happn_client.create({
          plugin: happn.client_plugins.intra_process,
          context: happnInstance
        }, function (e, instance) {

          if (e) return callback(e);
          listenerclient = instance;
          callback();

        });

      });

    } catch (e) {
      callback(e);
    }
  });


  var test_path = '/test/meta/' + require('shortid').generate();
  var test_path_remove = '/test/meta/remove' + require('shortid').generate();
  var test_path_all = '/test/meta/all' + require('shortid').generate();

//	We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

  it('tests the set meta data', function (callback) {

    this.timeout(default_timeout);

    try {
      //first listen for the change
      listenerclient.on(test_path, {event_type: 'set', count: 1}, function (data, meta) {

        //console.log('EVENT-DATA: ', data);
        //console.log('META: ', meta);

        expect(meta.path).to.be(test_path);
        callback();

      }, function (e) {

        if (!e) {

          expect(listenerclient.events['/SET@' + test_path].length).to.be(1);

          //then make the change
          publisherclient.set(test_path, {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {

            if (e) return callback(e);

            console.log('result:::', result);

            expect(result._meta.path).to.be(test_path);
          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('tests the update meta data', function (callback) {

    publisherclient.set(test_path, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, {}, function (e, result) {

      if (e) return callback(e);

      //console.log('SET-DATA: ', result);
      expect(result._meta.path).to.be(test_path);

      callback();

    });

  });

  it('tests the delete meta data', function (callback) {

    publisherclient.set(test_path_remove, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, {}, function (e, result) {

      if (e) return callback(e);


      expect(result._meta.path).to.be(test_path_remove);

      listenerclient.on(test_path_remove, {event_type: 'remove', count: 1}, function (data, meta) {

        console.log('REM-DATA: ', data, meta);
        expect(meta.path).to.be(test_path_remove);

        callback();

      }, function (e) {

        if (e) return callback(e);

        publisherclient.remove(test_path_remove,
          {},
          function (e, result) {

            if (e) return callback(e);

            expect(result._meta.path).to.be('/REMOVE@' + test_path_remove);

          });
      });
    });
  });

  it('tests the all meta data', function (callback) {

    this.timeout(default_timeout);

    try {
      //first listen for the change
      listenerclient.onAll(function (data, meta) {

        expect(meta.path).to.be(test_path_all);
        expect(meta.channel).to.be('/ALL@*');

        callback();

      }, function (e) {

        if (e) return callback(e);

        //then make the change
        publisherclient.set(test_path_all, {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        }, null, function (e, result) {

          if (e) return callback(e);

          expect(result._meta.path).to.be(test_path_all);

        });

      });

    } catch (e) {
      callback(e);
    }
  });

});
