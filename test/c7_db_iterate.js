describe('c7_ds_iterate', function () {

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_id = Date.now() + '_' + require('shortid').generate();
  var fs = require('fs');

  this.timeout(20000);

  var test_file1 = __dirname + '/test-resources/c7/test/' + test_id + '1.test';
  var test_file2 = __dirname + '/test-resources/c7/test/' + test_id + '2.test';
  var test_file2a = __dirname + '/test-resources/c7/test/' + test_id + '2a.test';

  var serviceConfig1 = {
    secure: true,
    port: 4444,
    services: {
      data: {
        config: {
          filename: test_file1
        }
      }
    }
  }

  var serviceConfig2 = {
    secure: true,
    port: 4447,
    services: {
      data: {
        config: {
          datastores: [
            {
              name: 'file2',
              settings: {
                filename: test_file2
              },
              patterns: [
                '/c7_ds_iterate/' + test_id + '/2/*'
              ]
            },
            {
              name: 'file2a',
              settings: {
                filename: test_file2a
              },
              patterns: [
                '/c7_ds_iterate/' + test_id + '/2a/*'
              ]
            }
          ]
        }
      }
    }
  };

  var clientConfig1 = {
    config: {
      secure: true,
      port: 4444,
      username: '_ADMIN',
      password: 'happn'
    }
  };

  var clientConfig2 = {
    config: {
      secure: true,
      port: 4447,
      username: '_ADMIN',
      password: 'happn'
    }
  };

  var serviceInstance1;

  var client1;
  var client2;

  var getService = function (config, callback) {
    happn.service.create(config,
      function (e, service) {
        if (e) return callback(e);
        callback(null, service);
      }
    );
  };

  var getClient = function (config, callback) {
    happn_client.create(config, callback);
  };

  before('it creates 2 test dss', function (callback) {
    this.timeout(4000);
    getService(serviceConfig1, function (e, serviceInstance) {
      if (e) return callback(e);
      serviceInstance1 = serviceInstance;
      getService(serviceConfig2, function (e, serviceInstance) {
        if (e) return callback(e);
        serviceInstance2 = serviceInstance;
        callback();
      });
    });
  });

  before('it creates 2 test clients', function (callback) {
    this.timeout(4000);
    getClient(clientConfig1, function (e, client) {
      if (e) return callback(e);
      client1 = client;
      getClient(clientConfig2, function (e, client) {
        if (e) return callback(e);
        client2 = client;
        callback();
      });
    });
  });

  after('it shuts down the test dss, and unlinks their file', function (callback) {
    serviceInstance1.stop(function (e) {
      fs.unlinkSync(test_file1);
      serviceInstance2.stop(function (e) {
        fs.unlinkSync(test_file2);
        callback();
      });
    });
  });

  it('iterates over a single default ds instance', function (callback) {

    serviceInstance1.services.data.__iterateDataStores(function (key, ds, next) {

      expect(key).to.be("default");
      expect(ds.db['persistence']).to.not.be(null);
      next();

    }, callback)
  });

  it('iterates over multiple ds instances', function (callback) {

    var keyCount = 0;

    serviceInstance2.services.data.__iterateDataStores(function (key, ds, next) {

      expect(['file2', 'file2a'].indexOf(key) > -1).to.be(true);
      expect(ds.db['persistence']).to.not.be(null);

      keyCount++;
      next();
    }, function (e) {
      expect(keyCount).to.be(2);
      callback();
    })
  });

  it('iterates a specific ds instance amongst multiple ds instances', function (callback) {

    var keyCount = 0;

    serviceInstance2.services.data.__iterateDataStores('file2a', function (key, ds, next) {
      expect(key).to.be('file2a');
      expect(ds.db['persistence']).to.not.be(null);
      keyCount++;
      next();
    }, function (e) {
      expect(keyCount).to.be(1);
      callback();
    })
  });

  it('iterates another specific ds instance amongst multiple ds instances', function (callback) {

    var keyCount = 0;

    serviceInstance2.services.data.__iterateDataStores('file2', function (key, ds, next) {
      expect(key).to.be('file2');
      expect(ds.db['persistence']).to.not.be(null);
      keyCount++;
      next();
    }, function (e) {
      expect(keyCount).to.be(1);
      callback();
    })
  });

  it('fails to find an instance on a single', function (callback) {
    serviceInstance1.services.data.__iterateDataStores('badkey', function (key, ds, next) {
      next(new Error('this should not have happened'));
    }, function (e) {
      expect(e).to.not.be(null);
      expect(e.toString()).to.be('Error: datastore with key badkey, specified, but multiple datastores not configured');
      callback();
    })
  });

  it('fails to find an instance on a multiple', function (callback) {
    serviceInstance2.services.data.__iterateDataStores('badkey', function (key, ds, next) {
      next(new Error('this should not have happened'));
    }, function (e) {
      expect(e).to.not.be(null);
      expect(e.toString()).to.be('Error: datastore with key badkey, does not exist');
      callback();
    })
  });


});
