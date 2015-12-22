
describe('9_eventemitter_meta.js', function () {

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

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

  after(function(done) {
      happnInstance.stop(done);
  });

  before('should initialize the service', function (callback) {

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
        function (e, happnInst) {
          if (e)
            return callback(e);

          happnInstance = happnInst;
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


  var test_path = '/test/meta/' + require('shortid').generate();
  var test_path_remove = '/test/meta/remove' + require('shortid').generate();
  var test_path_all = '/test/meta/all' + require('shortid').generate();
  var test_path_created_modified = '/test/meta/created_modified' + require('shortid').generate();
  var test_path_created_modified_notmerge = '/test/meta/created_modified_notmerge' + require('shortid').generate();
  var test_path_timestamp = '/test/meta/test_path_timestamp' + require('shortid').generate();
//	We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

  it('tests the set meta data', function (callback) {

    this.timeout(default_timeout);

    try {
      //first listen for the change
      listenerclient.on(test_path, {event_type: 'set', count: 1}, function (data, meta) {

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
        expect(meta.path).to.be(test_path_remove);
        callback();
      }, function(e){

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

  it('tests created and modified dates, merge', function (callback) {

    publisherclient.set(test_path_created_modified, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, {}, function (e, result) {

      if (e) return callback(e);

      expect(result._meta.created).to.not.be(null);
      expect(result._meta.created).to.not.be(undefined);

      expect(result._meta.modified).to.not.be(null);
      expect(result._meta.modified).to.not.be(undefined);

      expect(result._meta.modified.toString()).to.be(result._meta.created.toString());

      setTimeout(function(){

        publisherclient.set(test_path_created_modified, {
          property4: 'property4'
        }, {merge:true}, function (e, result) {

          if (e) return callback(e);

           publisherclient.get(test_path_created_modified, function(e, result){

            expect(result._meta.modified > result._meta.created).to.be(true);
            callback();

           });

        })

      }, 1000);

    });
  });

  it('tests created and modified dates, not merge', function (callback) {

    publisherclient.set(test_path_created_modified_notmerge, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, {}, function (e, result) {

      if (e) return callback(e);

      expect(result._meta.created).to.not.be(null);
      expect(result._meta.created).to.not.be(undefined);

      expect(result._meta.modified).to.not.be(null);
      expect(result._meta.modified).to.not.be(undefined);

      expect(result._meta.modified.toString()).to.be(result._meta.created.toString());

      setTimeout(function(){

        publisherclient.set(test_path_created_modified_notmerge, {
          property4: 'property4'
        }, {}, function (e, result) {

          if (e) return callback(e);

           publisherclient.get(test_path_created_modified_notmerge, function(e, result){

            expect(result._meta.modified > result._meta.created).to.be(true);
            callback();

           });

        })

      }, 1000);

    });
  });

  it('searches by timestamps', function (callback) {

    this.timeout(5000);

    var itemIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    var windowStart = Date.now();

    //we save 10 items, with timestamp path, then do a search with modified, then a search created - ensure the counts are right
    async.eachSeries(itemIndexes, 
    function(index, eachCallback){

      publisherclient.set(test_path_timestamp + index, {
          property4: 'property4',
          ind:index
      }, eachCallback);

    }, 
    function(e){

      if (e) return callback(e);

      //now set an 11th after a second

      setTimeout(function(){

        var windowEnd = Date.now();

        publisherclient.set(test_path_timestamp + 10, {
            property4: 'property4',
            ind:10
        }, function(e, eleventhItem){

          var searchCriteria = {
            '_meta.created':{
              '$gte':windowStart, 
              '$lt':windowEnd
            }   
          }

          publisherclient.get('*', {criteria:searchCriteria}, function(e, items){

            if (e) return callback(e);
            expect(items.length == 10).to.be(true);

            var searchCriteria = {
              '_meta.created':{
                '$gte':windowEnd
              }  
            }

            publisherclient.get('*', {criteria:searchCriteria}, function(e, items){

              if (e) return callback(e);

              expect(items.length == 1).to.be(true);
              expect(items[0].ind).to.be(10);

              setTimeout(function(){

                var lastModified = Date.now();

                publisherclient.set(test_path_timestamp + '0', {
                  modifiedProperty:'modified'
                }, {merge:true}, function(e, modifiedItem){

                  if (e) return callback(e);

                  var searchCriteria = {
                    '_meta.modified':{
                      '$gte':lastModified
                    }  
                  }

                  publisherclient.get('*', {criteria:searchCriteria}, function(e, items){

                    if (e) return callback(e);

                    expect(items.length == 1).to.be(true);
                    expect(items[0].ind).to.be(0);

                    callback();

                  });

                });

              }, 1000);

            });

          });

        });


      }, 2000);

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