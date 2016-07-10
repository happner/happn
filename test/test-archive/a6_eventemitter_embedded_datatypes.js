var expect = require('expect.js');
var happn = require('../lib/index')
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

describe('a6_eventemitter_embedded_datatypes', function () {

  var testport = 8000;
  var test_secret = 'test_secret';
  var mode = "embedded";
  var default_timeout = 10000;
  var happnInstance = null;
  var test_id;

  /*
   This test demonstrates starting up the happn service - 
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  before('should initialize the service', function (callback) {

    this.timeout(20000);

    test_id = Date.now() + '_' + require('shortid').generate();

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

  after(function (done) {
    happnInstance.stop(done);
  });


  var publisherclient;
  var listenerclient;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the 
   database whilst another listens for changes.
   */
  before('should initialize the clients', function (callback) {
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

  it('the publisher should set string data', function (callback) {

    this.timeout(default_timeout);

    try {
      var test_string = require('shortid').generate();
      var test_base_url = '/a6_eventemitter_embedded_datatypes/' + test_id + '/set/string/' + test_string;

      publisherclient.set(test_base_url, test_string, {noPublish: true}, function (e, result) {

        if (!e) {

          console.log(result);

          expect(result.value).to.be(test_string);

          publisherclient.get(test_base_url, null, function (e, result) {

            if (e) return callback(e);

            expect(result.value).to.be(test_string);

            callback(e);
          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set number data', function (callback) {

    this.timeout(default_timeout);

    try {

      var test_number = Math.random();
      var test_base_url = '/a6_eventemitter_embedded_datatypes/' + test_id + '/set/number/' + test_number.toString().replace('.', '');

      publisherclient.set(test_base_url, test_number, {noPublish: true}, function (e, result) {

        if (!e) {

          console.log(result);

          expect(result.value).to.be(test_number);

          publisherclient.get(test_base_url, null, function (e, result) {

            if (e) return callback(e);

            expect(result.value).to.be(test_number);

            callback(e);
          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }

  });

  it('the publisher should set boolean data', function (callback) {

    this.timeout(default_timeout);

    try {

      var test_bool = true;
      var test_base_url = '/a6_eventemitter_embedded_datatypes/' + test_id + '/set/boolean/' + test_bool.toString();

      publisherclient.set(test_base_url, test_bool, {noPublish: true}, function (e, result) {

        if (!e) {

          console.log(result);

          expect(result.value).to.be(test_bool);

          publisherclient.get(test_base_url, null, function (e, result) {

            if (e) return callback(e);

            expect(result.value).to.be(test_bool);

            callback(e);
          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set date data', function (callback) {

    this.timeout(default_timeout);

    try {

      var test_date = new Date();
      var test_base_url = '/a6_eventemitter_embedded_datatypes/' + test_id + '/set/date';

      publisherclient.set(test_base_url, test_date, {noPublish: true}, function (e, result) {

        if (!e) {

          console.log(result);

          expect(result.value).to.be(test_date);

          publisherclient.get(test_base_url, null, function (e, result) {

            if (e) return callback(e);

            expect(result.value).to.be(test_date);

            callback(e);
          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set null data', function (callback) {

    this.timeout(default_timeout);

    try {

      var test_null = null;
      var test_base_url = '/a6_eventemitter_embedded_datatypes/' + test_id + '/set/null';

      publisherclient.set(test_base_url, test_null, {noPublish: true}, function (e, result) {

        if (!e) {

          console.log('null, result', result);

          expect(result.value).to.be(test_null);

          publisherclient.get(test_base_url, null, function (e, result) {

            if (e) return callback(e);

            expect(result.value).to.be(test_null);//YES. IT IS NOW UNDEFINED

            callback(e);
          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set undefined data', function (callback) {

    this.timeout(default_timeout);

    try {

      var test_undefined = undefined;
      var test_base_url = '/a6_eventemitter_embedded_datatypes/' + test_id + '/set/undefined';

      publisherclient.set(test_base_url, test_undefined, {noPublish: true}, function (e, result) {

        if (!e) {

          console.log(result);

          expect(result.value).to.be(test_undefined);

          publisherclient.get(test_base_url, null, function (e, result) {

            if (e) return callback(e);

            expect(result.value).to.be(test_undefined);

            callback(e);
          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set array data', function (callback) {

    this.timeout(default_timeout);

    try {

      var test_array = [0, 1, 2, 3, 4, 5];
      var test_base_url = '/a6_eventemitter_embedded_datatypes/' + test_id + '/set/array';

      publisherclient.set(test_base_url, test_array, {noPublish: true}, function (e, result) {

        if (!e) {

          console.log('array result', result);

          expect(result.value.length).to.be(6);

          publisherclient.get(test_base_url, null, function (e, result) {

            if (e) return callback(e);

            expect(result.value.length).to.be(6);
            expect(result.value[0]).to.be(0);
            expect(result.value[5]).to.be(5);

            callback(e);

          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('wildcards, the listener should pick up a single wildcard event', function (callback) {

    this.timeout(default_timeout);

    var test_base_url = '/a6_eventemitter_embedded_datatypes/' + test_id + '/wildcard';
    var test_path_end = require('shortid').generate();

    try {

      //first listen for the change
      listenerclient.on(test_base_url + '/*', {event_type: 'set', count: 1}, function (message) {

        expect(listenerclient.events['/SET@' + test_base_url + '/*'].length).to.be(0);

        expect(message.value == "test string").to.be(true);

        callback();

      }, function (e) {

        //////////////////console.log('ON HAS HAPPENED: ' + e);

        if (!e) {

          expect(listenerclient.events['/SET@' + test_base_url + '/*'].length).to.be(1);
          //////////////////console.log('on subscribed, about to publish');

          //then make the change
          publisherclient.set(test_base_url + '/' + test_path_end, "test string", null, function (e, result) {


          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

});
