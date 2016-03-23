describe('c7_db_compaction', function() {

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_id = Date.now() + '_' + require('shortid').generate();
  var fs = require('fs');

  this.timeout(10000);

  var initialFileSize = 0;

  var test_file1 = __dirname + '/test-resources/c7/test/' + test_id + '1.test';
  var test_file2 = __dirname + '/test-resources/c7/test/' + test_id + '2.test';
  var test_file3 = __dirname + '/test-resources/c7/test/' + test_id + '3.test';

  var serviceConfig1 =  {
    secure:true,
    port:4444,
    services: {
      data: {
        path: './services/data_embedded/service.js',
        config:{
           filename:test_file1
        }
      }
    }
  }
  var serviceConfig2 = {
    secure:true,
    port:4445,
    services: {
      data: {
        path: './services/data_embedded/service.js',
        config:{
           filename:test_file2
        }
      }
    }
  }

  var serviceConfig3 = {
    secure:true,
    port:4446,
    services: {
      data: {
        path: './services/data_embedded/service.js',
        config:{
           filename:test_file3,
           compactInterval:500//compact every second
        }
      }
    }
  }

  var clientConfig1 = {
    config:{
      secure:true,
      port:4444,
      username:'_ADMIN',
      password:'happn'
    }
  }

  var clientConfig2 = {
    config:{
      secure:true,
      port:4445,
      username:'_ADMIN',
      password:'happn'
    }
  }

  var clientConfig3 = {
    config:{
      secure:true,
      port:4446,
      username:'_ADMIN',
      password:'happn'
    }
  }

  var serviceInstance1;
  var serviceInstance2;
  var serviceInstance3;

  var RandomActivityGenerator = require(__dirname + "/test-resources/random_activity_generator");

  var randomActivity1;
  var randomActivity2;
  var randomActivity3;

  var client1;
  var client2;
  var client3;

  var getService = function(config, callback){
   happn.service.create(config,
      function(e, service){
        if (e) return callback(e);
        callback(null, service);
      }
    );
  }

  var getClient = function(config, callback){
     happn_client.create(config,
      function(e, instance) {

        if (e) return callback(e);
        testClient = instance;
        callback();

      });
  }

  before('it creates 2 test dbs', function(callback){
    getService(serviceConfig1, function(e, serviceInstance){
      if (e) return callback(e);
      serviceInstance1 = serviceInstance;
      getService(serviceConfig2, function(e, serviceInstance){
        if (e) return callback(e);
        serviceInstance2 = serviceInstance;
        callback();
      });
    });
  });

  before('it creates 3 test clients and data generators', function(callback){
    getClient(clientConfig1, function(e, client){
      if (e) return callback(e);
      console.log('client1 created:::');
      client1 = client;
      getClient(clientConfig2, function(e, client){
        if (e) return callback(e);
        console.log('client2 created:::');
        client2 = client;
        callback();
      });
    });
  });

  after('it shuts down the test dbs, and unlinks their file', function(callback){
    serviceInstance1.stop(function(e){
      fs.unlinkSync(test_file1);
       serviceInstance2.stop(function(e){
          fs.unlinkSync(test_file2);
          serviceInstance3.stop(function(e){
            fs.unlinkSync(test_file3);
            callback();
          });
        });
    });
  });

  function getFileSize(filepath){

  }

  it('for testfile1 creates data, measures the db size, compacts the db, checks the new db filesize is smaller than the original db', function(callback){

    var fileSizeInitial = getFileSize(test_file1);

    randomActivity1 = new RandomActivityGenerator(client1);

    randomActivity1.generateActivity(1000, function(e){

      var fileSizeAfterActivity = getFileSize(test_file1);
      expect(fileSizeAfterActivity > fileSizeInitial).to.be(true);

      serviceInstance1.services.data.compact(function(e){
        var fileSizeAfterCompact = getFileSize(test_file1);
        expect(fileSizeAfterCompact > fileSizeInitial).to.be(true);
        expect(fileSizeAfterCompact < fileSizeAfterActivity).to.be(true);
        callback();
      });
    });

  });

  it('starts compaction for every n seconds, then do random inserts and deletes, then verify the data', function(callback){
    var fileSizeInitial = getFileSize(test_file2);

    randomActivity2 = new RandomActivityGenerator(client2);

    randomActivity2.generateActivityStart();

    var compactionCount = 0;

    serviceInstance2.services.data.compact(1000, function(e){

      if (e) return callback(e);

      compactionCount++;

      if (compactionCount == 3){//we have compacted 3 times
        randomActivity2.generateActivityEnd();
        randomActivity2.verifyData();//checks to see all the data that should be there exists and all the data that shouldnt be there doesnt
      }

    });

  });

  it('starts a db configured to compact, does a replay of random activity1, then verifies the data is smaller than the initial size of the uncompacted file', function(callback){
    getService(serviceConfig3, function(e, serviceInstance){
      if (e) return callback(e);
      serviceInstance3 = serviceInstance;
      getClient(clientConfig3, function(e, client){

          if (e) return callback(e);
          console.log('client3 created:::');
          client3 = client;

          randomActivity3 = new RandomActivityGenerator(client3);
          randomActivity3.replay(randomActivity1, function(e){

            if (e) return callback(e);


          });

      });
    });
  });

});