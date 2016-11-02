describe('c7a_db_compaction', function () {

  var expect = require('expect.js');
  var happn = require('../../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_id = Date.now() + '_' + require('shortid').generate();
  var fs = require('fs');

  this.timeout(30000);

  var initialFileSize = 0;

  var testFiles = [];
  var testServices = [];

  var test_file1 = __dirname + '/test-resources/c7a/test/' + test_id + '1.test';
  var test_file2 = __dirname + '/test-resources/c7a/test/' + test_id + '2.test';
  var test_file3 = __dirname + '/test-resources/c7a/test/' + test_id + '3.test';
  var test_file4 = __dirname + '/test-resources/c7a/test/' + test_id + '4.test';
  var test_file4a = __dirname + '/test-resources/c7a/test/' + test_id + '4a.test';

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
    port: 4445,
    services: {
      data: {
        config: {
          filename: test_file2
        }
      }
    }
  }

  var serviceConfig3 = {
    secure: true,
    port: 4446,
    services: {
      data: {
        config: {
          filename: test_file3,
          compactInterval: 5000//compact every 5 seconds
        }
      }
    }
  }

  var serviceConfig4 = {
    secure: true,
    port: 4447,
    services: {
      data: {
        config: {
          datastores: [
            {
              name: 'file4',
              settings: {
                filename: test_file4
              },
              patterns: [
                '/c7a_db_compaction/' + test_id + '/4/*'
              ]
            },
            {
              name: 'file4a',
              settings: {
                filename: test_file4a
              },
              patterns: [
                '/c7a_db_compaction/' + test_id + '/4a/*'
              ]
            }
          ]
        }
      }
    }
  }

  var clientConfig1 = {
    config: {
      secure: true,
      port: 4444,
      username: '_ADMIN',
      password: 'happn'
    }
  }

  var clientConfig2 = {
    config: {
      secure: true,
      port: 4445,
      username: '_ADMIN',
      password: 'happn'
    }
  }

  var clientConfig3 = {
    config: {
      secure: true,
      port: 4446,
      username: '_ADMIN',
      password: 'happn'
    }
  }

  var clientConfig4 = {
    config: {
      secure: true,
      port: 4447,
      username: '_ADMIN',
      password: 'happn'
    }
  }

  var serviceInstance1;
  var serviceInstance2;
  var serviceInstance3;

  var RandomActivityGenerator = require("happn-random-activity-generator");

  var randomActivity1;
  var randomActivity2;
  var randomActivity3;
  var randomActivity4;

  var client1;
  var client2;
  var client3;
  var client4;

  var getService = function (config, callback) {
    happn.service.create(config,
      function (e, service) {
        if (e) return callback(e);
        callback(null, service);
      }
    );
  }

  var getClient = function (config, callback) {
    happn_client.create(config, callback);
  }

  before('it creates 2 test dbs', function (callback) {
    getService(serviceConfig1, function (e, serviceInstance) {
      if (e) return callback(e);
      serviceInstance1 = serviceInstance;
      testServices.push(serviceInstance1);
      getService(serviceConfig2, function (e, serviceInstance) {
        if (e) return callback(e);
        serviceInstance2 = serviceInstance;
        testServices.push(serviceInstance2);
        callback();
      });
    });
  });

  before('it creates 3 test clients', function (callback) {
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

  after('it shuts down the test dbs, and unlinks their file', function (callback) {

    var afterErrors = [];

    //stop services
    async.eachSeries(testServices, function (service, next) {
      service.stop(next);
    }, function (e) {

      if (e) {
        afterErrors.push(e);
        console.log("service failed to stop:::", service);
      }

      //unlink files
      async.eachSeries(testFiles, function (filePath, next) {
        fs.unlinkSync(filePath);
        next();
      }, function (e) {

        if (e) afterErrors.push(e);

        if (afterErrors.length > 0)
          return callback(afterErrors);

        callback();

      });
    });
  });

  function getFileSize(filepath) {
    var stats = fs.statSync(filepath);
    //Convert the file size to megabytes (optional)
    if (!stats) return 0;
    if (!stats["size"]) return 0;

    return stats["size"];
  }

  var fileSizeAfterActivity1;

  it('for testfile1 creates data, measures the db size, compacts the db, checks the new db filesize is smaller than the original db', function (callback) {

    var fileSizeInitial = getFileSize(test_file1);

    randomActivity1 = new RandomActivityGenerator(client1);
    randomActivity1.generateActivityStart("test", function () {
      setTimeout(function () {
        randomActivity1.generateActivityEnd("test", function (aggregatedLog) {

          testFiles.push(test_file1);

          fileSizeAfterActivity1 = getFileSize(test_file1);
          expect(fileSizeAfterActivity1 > fileSizeInitial).to.be(true);

          serviceInstance1.services.data.compact(function (e) {
            var fileSizeAfterCompact = getFileSize(test_file1);

            expect(fileSizeAfterCompact > fileSizeInitial).to.be(true);
            expect(fileSizeAfterCompact < fileSizeAfterActivity1).to.be(true);
            callback();
          });
        });

      }, 2000);
    });

  });

  it('starts a db configured to compact, does a replay of random activity1, then verifies the data is smaller than the initial size of the uncompacted file', function (callback) {
    getService(serviceConfig3, function (e, serviceInstance) {

      if (e) return callback(e);
      serviceInstance3 = serviceInstance;

      getClient(clientConfig3, function (e, client) {

        if (e) return callback(e);
        client3 = client;
        randomActivity3 = new RandomActivityGenerator(client3);

        randomActivity3.replay(randomActivity1, 'test', function (e) {//we perform the same set of operations we did in the first test

          if (e) return callback(e);

          testFiles.push(test_file3);

          setTimeout(function () {

            var fileSizeAfterActivity3 = getFileSize(test_file3);
            expect(fileSizeAfterActivity3 < fileSizeAfterActivity1).to.be(true);
            randomActivity3.verify(callback);

          }, 8000);

        });
      });
    });
  });

  it('starts a db with 2 files, does some random activity, compacts the db, checks that both files have been compacted', function (callback) {
    getService(serviceConfig4, function (e, serviceInstance) {
      if (e) return callback(e);
      serviceInstance4 = serviceInstance;
      testServices.push(serviceInstance4);
      getClient(clientConfig4, function (e, client) {
        if (e) return callback(e);
        client4 = client;

        randomActivity4 = new RandomActivityGenerator(client4, {pathPrefix: ['/c7a_db_compaction/' + test_id + '/4/', '/c7a_db_compaction/' + test_id + '/4a/']});

        var fileSizeInitial4 = getFileSize(test_file4);
        var fileSizeInitial4a = getFileSize(test_file4a);

        randomActivity4.generateActivityStart("test", function () {

          setTimeout(function () {

            randomActivity4.generateActivityEnd("test", function (aggregatedLog) {

              var fileSizeAfterActivity4 = getFileSize(test_file4);
              var fileSizeAfterActivity4a = getFileSize(test_file4a);

              testFiles.push(test_file4);
              testFiles.push(test_file4a);

              expect(fileSizeAfterActivity4 > fileSizeInitial4).to.be(true);
              expect(fileSizeAfterActivity4a > fileSizeInitial4a).to.be(true);

              serviceInstance4.services.data.compact(function (e) {

                if (e) return callback(e);

                var fileSizeAfterCompact4 = getFileSize(test_file4);
                var fileSizeAfterCompact4a = getFileSize(test_file4a);

                expect(fileSizeAfterCompact4 < fileSizeAfterActivity4).to.be(true);
                expect(fileSizeAfterCompact4a < fileSizeAfterActivity4a).to.be(true);

                callback();
              });

            });

          }, 2000);
        });

      });
    });
  });

  it('starts compaction for every n seconds, then do random inserts and deletes, then verify the data', function (callback) {

    var fileSizeInitial = getFileSize(test_file2);
    randomActivity2 = new RandomActivityGenerator(client2, {interval: 3000, verbose: true});

    randomActivity2.generateActivityStart("test", function (e) {
      if (e) return callback(e);

      var compactionCount = 0;
      var verified = false;
      testFiles.push(test_file2);

      serviceInstance2.services.data.startCompacting(5000, function (e) {
        if (e) return callback(e);
        //DO NADA
      }, function () {
        compactionCount++;
        if (compactionCount == 2) {//we have compacted 2 times
          if (!verified) {
            verified = true;
            randomActivity2.generateActivityEnd("test", function (aggregatedLog) {
              //checks to see all the data that should be there exists and all the data that shouldnt be there doesnt
              randomActivity2.verify(callback);
            });
          }
        }
      });

    });

  });

});
