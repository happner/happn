var expect = require('expect.js');
var async = require('async');
var fs = require('fs');
var happn = require('../lib/index');

describe('c4_security_persisted_restart', function () {

  var testport = 8000;
  var test_secret = 'test_secret';
  var mode = "embedded";
  var default_timeout = 10000;
  var happnInstance = null;
  var tempFile = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';
  var persistKey = '/persistence_test/' + require('shortid').generate();
  var currentService = null;
  var ADMIN_PWD = require('shortid').generate();

  var testConfig = {
    secure: true,
    services: {
      security: {
        //path: './services/security/service.js',
        config: {
          adminUser: {password: ADMIN_PWD}
        }
      },
      data: {
        path: './services/data_embedded/service.js',
        config: {
          dbfile: tempFile
        }
      }
    },
    utils: {
      log_level: 'info|error|warning',
      log_component: 'prepare'
    }
  }

  var getService = function (config, callback) {
    happn.service.create(config,
      function (e, happnService) {
        if (e) return callback(e);

        currentService = happnService;
        callback();
      }
    );
  }

  var getClient = function (credentials, service, callback) {
    happn.client.create({
      plugin: happn.client_plugins.intra_process,
      context: service,
      config: credentials,
      secure: true
    }, function (e, instance) {

      if (e) return callback(e);

      callback(null, instance);

    });
  }

  before('should initialize the service', function (callback) {

    this.timeout(20000);
    getService(testConfig, callback);

  });

  after('should delete the temp data file', function (callback) {

    this.timeout(20000);

    fs.unlink(tempFile, function (e) {
      if (e) return callback(e);
      currentService.stop(callback);
    });

  });


  it('should login with the _ADMIN user', function (callback) {

    this.timeout(default_timeout);

    getClient({username: '_ADMIN', password: ADMIN_PWD}, currentService, function (e, testclient) {

      if (e) return callback(e);

      testclient.set(persistKey,
        {property1: "prop1", prop2: "prop2"},
        null,
        callback
      );

    });

  });

  it('removes the admin password from the config, then should restart the service and login with the same admin credentials', function (callback) {

    this.timeout(default_timeout);

    currentService.stop(function (e) {
      if (e) return callback(e);

      delete testConfig.services.security.config.adminUser;

      getService(testConfig, function (e) {

        if (e) return callback(e);

        getClient({username: '_ADMIN', password: ADMIN_PWD}, currentService, function (e, testclient) {

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

  it('modifies the config with new admin credentials, restarts the service - logs in with new admin credentials', function (callback) {

    this.timeout(default_timeout);

    currentService.stop(function (e) {
      if (e) return callback(e);

      var newCredentials = {password: 'MODIFIED'};

      testConfig.services.security.config.adminUser = newCredentials;

      getService(testConfig, function (e) {

        if (e) return callback(e);

        getClient({username: '_ADMIN', password: 'MODIFIED'}, currentService, function (e, testclient) {

          if (e) return callback(e);

          testclient.get(persistKey, null, function (e, response) {

            if (e) return callback(e);

            // expect(response.property1).to.be("prop1");
            callback();
          });

        });
      });
    });
  });

});
