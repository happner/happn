describe('b2_eventemitter_security_stoppingstarting', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  context('stopping and starting secure meshes', function () {

    var expect = require('expect.js');
    var async = require('async');
    var fs = require('fs');
    var happn = require('../lib/index');

    var testport = 8000;
    var test_secret = 'test_secret';
    var mode = "embedded";
    var default_timeout = 10000;
    var happnInstance = null;
    var tmpFile = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';
    var persistKey = '/persistence_test/' + require('shortid').generate();
    var currentService = null;

    var stopService = function (callback) {
      if (currentService) {
        currentService.stop(function (e) {
          if (e && e.toString() != 'Error: Not running') return callback(e);
          callback();
        });
      } else callback();
    }

    var initService = function (filename, name, callback) {

      var doInitService = function () {

        var serviceConfig = {
          services:{
            data:{
              config:{

              }
            }
          },
          secure: true
        };

        serviceConfig.services.data.config.filename = filename;
        serviceConfig.name = name;

        happn.service.create(serviceConfig,
          function (e, happnService) {
            if (e) return callback(e);
            currentService = happnService;
            callback();
          }
        );
      };

      stopService(function (e) {
        if (e) return callback(e);
        doInitService();
      });
    };

    var getClient = function (service, callback) {

      service.services.session.localClient({username:'_ADMIN', password:'happn'}, function(e, instance){
        if (e) return callback(e);

        callback(null, instance);
      });
    };

    before('should initialize the service', function (callback) {

      this.timeout(20000);
      initService(tmpFile, 'b2_eventemitter_security_stoppingstarting', callback);

    });

    after('should delete the temp data file', function (callback) {

      this.timeout(20000);

      stopService(function (e) {
        fs.unlink(tmpFile, function (e) {
          callback();
        });
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
      initService(tmpFile, 'b2_eventemitter_security_stoppingstarting', function (e) {

        if (e) return callback(e);

        getClient(currentService, function (e, testclient) {

          if (e) return callback(e);

          testclient.get(persistKey, null, function (e, response) {

            if (e) return callback(e);

            expect(response.property1).to.be("prop1");
            callback();
          });

        });
      });
    });

    it('should create a memory server - check for the data - shouldnt be any', function (callback) {

      this.timeout(default_timeout);

      initService(null, 'b2_eventemitter_security_stoppingstarting', function (e) {

        if (e) return callback(e);

        getClient(currentService, function (e, testclient) {

          if (e) return callback(e);

          testclient.get(persistKey, null, function (e, response) {

            if (e) return callback(e);

            expect(response).to.eql(null);
            callback();
          });

        });
      });

    });

    it('should stop then start and verify the server name', function (callback) {

      this.timeout(default_timeout);
      initService(tmpFile, 'b2_eventemitter_security_stoppingstarting', function (e) {

        if (e) return callback(e);

        var currentPersistedServiceName = currentService.services.system.name;
        expect(currentPersistedServiceName).to.be('b2_eventemitter_security_stoppingstarting');

        initService(null, null, function (e) {

          var currentUnpersistedServiceName = currentService.services.system.name;
          expect(currentUnpersistedServiceName).to.not.be('b2_eventemitter_security_stoppingstarting');
          expect(currentUnpersistedServiceName).to.not.be(null);
          expect(currentUnpersistedServiceName).to.not.be(undefined);

          initService(tmpFile, null, function (e) {
            if (e) return callback(e);

            var currentPersistedRestartedServiceName = currentService.services.system.name;
            expect(currentPersistedRestartedServiceName).to.be('b2_eventemitter_security_stoppingstarting');
            callback();

          });

        });

      });


    });

    it('should stop then start and verify the server keypair', function (callback) {

      this.timeout(default_timeout);
      initService(tmpFile, 'b2_eventemitter_security_stoppingstarting', function (e) {

        if (e) return callback(e);

        var currentPersistedServicePublicKey = currentService.services.security._keyPair.publicKey.toString();

        expect(currentPersistedServicePublicKey).to.not.be(null);
        expect(currentPersistedServicePublicKey).to.not.be(undefined);
        expect(currentPersistedServicePublicKey).to.not.be('');

        initService(null, null, function (e) {

          var currentUnPersistedServicePublicKey = currentService.services.security._keyPair.publicKey.toString();
          expect(currentUnPersistedServicePublicKey).to.not.be(currentPersistedServicePublicKey);
          expect(currentUnPersistedServicePublicKey).to.not.be(null);
          expect(currentUnPersistedServicePublicKey).to.not.be(undefined);
          expect(currentUnPersistedServicePublicKey).to.not.be('');

          initService(tmpFile, null, function (e) {
            if (e) return callback(e);

            var currentPersistedRestartedServicePublicKey = currentService.services.security._keyPair.publicKey.toString();
            expect(currentPersistedRestartedServicePublicKey).to.be(currentPersistedServicePublicKey);
            callback();

          });

        });

      });


    });

  });

  require('benchmarket').stop();

});
