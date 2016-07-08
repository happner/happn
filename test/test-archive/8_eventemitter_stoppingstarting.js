var expect = require('expect.js');
var async = require('async');
var fs = require('fs');
var happn = require('../lib/index');

describe('8_eventemitter_stoppingstarting', function () {

  var testport = 8000;
  var test_secret = 'test_secret';
  var mode = "embedded";
  var default_timeout = 10000;
  var happnInstance = null;
  var tempFile = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';
  var persistKey = '/persistence_test/' + require('shortid').generate();
  var currentService = null;

  var getService = function (dbfile, callback) {
    happn.service.create({
        mode: 'embedded',
        services: {
          data: {
            path: './services/data_embedded/service.js',
            config: {
              dbfile: dbfile
            }
          }
        },
        utils: {
          log_level: 'info|error|warning',
          log_component: 'prepare'
        }
      },
      callback
    );
  }

  var getClient = function (service, callback) {
    happn.client.create({
      plugin: happn.client_plugins.intra_process,
      context: service
    }, function (e, instance) {

      if (e) return callback(e);

      callback(null, instance);

    });
  }

  before('should initialize the service', function (callback) {

    this.timeout(20000);
    getService(tempFile, function (e, happnService) {

      if (e) return callback(e);

      currentService = happnService;
      callback();
    });

  });

  after('should delete the temp data file', function (callback) {

    this.timeout(20000);

    fs.unlink(tempFile, function (e) {
      if (e) return callback(e);
      currentService.stop(callback);
    });

  });


  it('should push some data into a permanent datastore', function (callback) {

    this.timeout(default_timeout);

    getClient(currentService, function (e, testclient) {

      if (e) return callback(e);

      testclient.set(persistKey,
        {property1: "prop1", prop2: "prop2"},
        null,
        callback
      );

    });

  });

  it('should disconnect then reconnect and reverify the data', function (callback) {

    this.timeout(default_timeout);

    currentService.stop(function (e) {
      if (e) return callback(e);

      getService(tempFile, function (e, happnService) {

        if (e) return callback(e);

        currentService = happnService;

        getClient(happnService, function (e, testclient) {

          if (e) return callback(e);

          testclient.get(persistKey, null, function (e, response) {

            if (e) return callback(e);

            expect(response.property1).to.be("prop1");
            callback();
          });

        });
      });
    });
  });

  it('should create a memory server - check for the data - shouldnt be any', function (callback) {

    this.timeout(default_timeout);

    currentService.stop(function (e) {
      if (e) return callback(e);

      getService(null, function (e, happnService) {

        if (e) return callback(e);

        currentService = happnService;

        getClient(happnService, function (e, testclient) {

          if (e) return callback(e);

          //console.log(persistKey);

          testclient.get(persistKey, null, function (e, response) {

            if (e) return callback(e);

            expect(response).to.eql(null);
            callback();
          });

        });
      });
    });
  });

});
