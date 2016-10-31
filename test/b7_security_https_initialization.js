describe('b7_security_https', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var happn = require('../lib/index');
  var happn_client = happn.client;

  var serviceInstance;
  var testClient;

  var expect = require('expect.js');
  var test_id = Date.now() + '_' + require('shortid').generate();
  var async = require('async');

  var config = require('./test-resources/b7_security_https_initialization_config.js')
  var fs = require('fs');


  var clientConfig = {
    config: {
      protocol: 'https',
      allowSelfSignedCerts: true
    }
  };

  var getService = function (config, callback) {
    happn.service.create(config,
      function (e, service) {
        if (e) return callback(e);
        serviceInstance = service;
        callback();
      }
    );
  };

  var getClient = function (config, callback) {
    happn_client.create(config,
      function (e, instance) {

        if (e) return callback(e);
        testClient = instance;
        callback();

      });
  };

  this.timeout(15000);

  afterEach(function (done) {

    if (testClient && serviceInstance) {
      testClient.disconnect()
        .then(serviceInstance.stop()
          .then(function () {
            testClient = null;
            serviceInstance = null;
            done();
          }))
        .catch(done);
    } else done();

  });

  it('starts an https server, with a configured cert and key', function (done) {

    var serviceConfig = config.test1_config;

    getService(serviceConfig, function (e) {

      if (e) return done(e);

      console.log('got service:::');

      getClient(clientConfig, done);

    });

  });

  it('starts an https server, with a configured cert and key file path pointing to existing files', function (done) {

    var serviceConfig = config.test2_config;

    getService(serviceConfig, function (e) {

      if (e) return done(e);

      getClient(clientConfig, done);

    });

  });

  it('starts an https server, with a configured cert and key file path pointing to non-existing files', function (done) {
    //we check for the files existences afterwards - then delete them as well

    if (process.env.TRAVIS) return done();

    var serviceConfig = config.test3_config;

    getService(serviceConfig, function (e) {

      if (e) return done(e);

      getClient(clientConfig, function (e) {

        if (e) return done(e);

        var certStats = fs.statSync(serviceConfig.services.transport.config.certPath);
        var keyStats = fs.statSync(serviceConfig.services.transport.config.keyPath)

        expect(certStats.isFile()).to.equal(true);
        expect(keyStats.isFile()).to.equal(true);

        fs.unlinkSync(serviceConfig.services.transport.config.certPath);
        fs.unlinkSync(serviceConfig.services.transport.config.keyPath);

        done();

      });

    });

  });

  it('it fails to start an https, due to bad values in the cert', function (done) {

    if (process.env.TRAVIS)
      return done();

    var serviceConfig = config.test4_config;

    getService(serviceConfig, function (e) {
      // expect(e.toString()).to.equal('Error: error creating server: error:140DC009:SSL routines:SSL_CTX_use_certificate_chain_file:PEM lib');
      expect(e.toString()).to.match(/PEM/);
      done();
    });

  });

  it('it fails to start an https, due to bad values in the key', function (done) {

    if (process.env.TRAVIS)
      return done();

    var serviceConfig = config.test5_config;

    getService(serviceConfig, function (e) {
      // expect(e.toString()).to.equal('Error: error creating server: PEM_read_bio_PrivateKey');
      expect(e.toString()).to.match(/PEM/);
      done();
    });

  });

  it('it fails to start an https server, missing key', function (done) {

    if (process.env.TRAVIS) return done();

    var serviceConfig = config.test6_config;

    getService(serviceConfig, function (e) {
      expect(e.toString()).to.equal('Error: key file missing for cert');
      done();
    });

  });

  it('it fails to start an https server, missing cert', function (done) {

    if (process.env.TRAVIS) return done();

    var serviceConfig = config.test7_config;

    getService(serviceConfig, function (e) {
      expect(e.toString()).to.equal('Error: cert file missing key');
      done();
    });

  });

  it('it fails to start an https server, missing key file path', function (done) {

    if (process.env.TRAVIS)
      return done();

    var serviceConfig = config.test8_config;

    getService(serviceConfig, function (e) {
      expect(e.toString()).to.equal('Error: missing key file: ' + serviceConfig.services.transport.config.keyPath);
      done();
    });


  });

  it('it fails to start an https server, missing cert file path', function (done) {

    if (process.env.TRAVIS) return done();

    var serviceConfig = config.test9_config;

    getService(serviceConfig, function (e) {
      expect(e.toString()).to.equal('Error: missing cert file: ' + serviceConfig.services.transport.config.certPath);
      done();
    });

  });

  require('benchmarket').stop();

});
