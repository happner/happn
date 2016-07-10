var expect = require('expect.js');
var happn = require('../lib/index')
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

describe('a7_eventemitter_embedded_paths', function () {

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

    test_id = Date.now() + '_' + require('shortid').generate() + '_-12@.hello.com';

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


  it('the listener should pick up a single wildcard event', function (callback) {

    this.timeout(default_timeout);

    try {

      //first listen for the change
      listenerclient.on('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event/*', {
        event_type: 'set',
        count: 1
      }, function (message) {

        expect(listenerclient.events['/SET@/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event/*'].length).to.be(0);
        callback();

      }, function (e) {

        //////////////////console.log('ON HAS HAPPENED: ' + e);

        if (!e) {

          expect(listenerclient.events['/SET@/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event/*'].length).to.be(1);
          //////////////////console.log('on subscribed, about to publish');

          var stats = happnInstance.stats();

          //console.log(stats.pubsub.listeners_wildcard_SET);

          //then make the change
          publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event/blah', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {
            //console.log('put happened - listening for result');
          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });


  it('the publisher should set new data', function (callback) {

    this.timeout(default_timeout);

    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {noPublish: true}, function (e, result) {

        if (!e) {
          publisherclient.get('a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end, null, function (e, results) {

            if (e) return callback(e);


            // expect(results.payload.length == 1).to.be(true);
            expect(results.property1 == 'property1').to.be(true);

            if (mode != 'embedded')
              expect(results.payload[0].created == results.payload[0].modified).to.be(true);

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

  it('should search for data with more than one wildcard', function (callback) {

    this.timeout(default_timeout);

    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/wildcards/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {noPublish: true}, function (e, result) {

        if (!e) {
          publisherclient.get('*/' + test_id + '/testsubscribe/wildcards/*', null, function (e, results) {

            if (e) return callback(e);

            expect(results.length > 0).to.be(true);
            //expect(results[0].property1 == 'property1').to.be(true);

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

  it('set_multiple, the publisher should set multiple data items, then do a wildcard get to return them', function (callback) {

    this.timeout(default_timeout);
    var timesCount = 10;

    var testBasePath = '/a7_eventemitter_embedded_paths/' + test_id + '/set_multiple'

    try {

      async.times(timesCount,
        function (n, timesCallback) {

          var test_random_path2 = require('shortid').generate();

          publisherclient.set(testBasePath + '/' + test_random_path2, {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, {noPublish: true}, timesCallback);

        },
        function (e) {

          if (e) return callback(e);

          listenerclient.get(testBasePath + '/' + '*', null, function (e, results) {

            if (e) return callback(e);

            expect(results.length).to.be(timesCount);

            results.every(function (result) {

              /*
               RESULT SHOULD LOOK LIKE THIS
               { property1: 'property1',
               property2: 'property2',
               property3: 'property3',
               _meta: 
               { modified: 1443606046766,
               created: 1443606046766,
               path: '/a7_eventemitter_embedded_paths/1443606046555_VkyH6cE1l/set_multiple/E17kSpqE1l' } }
               */

              expect(result._meta.path.indexOf(testBasePath) == 0).to.be(true);


              return true;
            });

            callback();

          });

        });


    } catch (e) {
      callback(e);
    }
  });


  it('should set data, and then merge a new document into the data without overwriting old fields', function (callback) {

    this.timeout(default_timeout);

    try {

      var test_path_end = require('shortid').generate();

      publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/merge/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, result) {

        if (e)
          return callback(e);

        //////////////console.log('set results');
        //////////////console.log(result);

        publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/merge/' + test_path_end, {property4: 'property4'}, {merge: true}, function (e, result) {

          if (e)
            return callback(e);

          //////////////console.log('merge set results');
          //////////////console.log(result);

          publisherclient.get('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/merge/' + test_path_end, null, function (e, results) {

            if (e)
              return callback(e);

            //////////////console.log('merge get results');
            //////////////console.log(results);

            expect(results.property4).to.be('property4');
            expect(results.property1).to.be('property1');

            callback();

          });

        });

      });

    } catch (e) {
      callback(e);
    }
  });

  it('should contain the same payload between 2 non-merging consecutive stores', function (done) {
    var object = {param1: 10, param2: 20};
    var firstTime;

    listenerclient.on('setTest/object', {event_type: 'set', count: 2}, function (message) {
      if (firstTime === undefined) {
        firstTime = message;
        return;
      } else {
        expect(message).to.eql(firstTime);
        done();
      }
    }, function (err) {
      expect(err).to.not.be.ok();
      publisherclient.set('setTest/object', object, {}, function (err) {
        expect(err).to.not.be.ok();
        publisherclient.set('setTest/object', object, {}, function (err) {
          expect(err).to.not.be.ok();
        });
      });
    })
  });

  it('should contain the same payload between a merge and a normal store for first store', function (done) {
    var object = {param1: 10, param2: 20};
    var firstTime = true;

    listenerclient.on('mergeTest/object', {event_type: 'set', count: 2}, function (message) {
      expect(message).to.eql(object);
      if (firstTime) {
        firstTime = false;
        return;
      }
      done();
    }, function (err) {
      expect(err).to.not.be.ok();
      publisherclient.set('mergeTest/object', object, {merge: true}, function (err) {
        expect(err).to.not.be.ok();
        publisherclient.set('mergeTest/object', object, {merge: true}, function (err) {
          expect(err).to.not.be.ok();
        });
      });
    })
  });


  it('should search for a complex object', function (callback) {

    //////////////////////////console.log('DOING COMPLEX SEARCH');

    var test_path_end = require('shortid').generate();

    var complex_obj = {
      regions: ['North', 'South'],
      towns: ['North.Cape Town'],
      categories: ['Action', 'History'],
      subcategories: ['Action.angling', 'History.art'],
      keywords: ['bass', 'Penny Siopis'],
      field1: 'field1'
    };


    var criteria1 = {
      $or: [{"data.regions": {$in: ['North', 'South', 'East', 'West']}},
        {"data.towns": {$in: ['North.Cape Town', 'South.East London']}},
        {"data.categories": {$in: ["Action", "History"]}}],
      "data.keywords": {$in: ["bass", "Penny Siopis"]}
    }

    var options1 = {
      fields: {"data": 1},
      sort: {"data.field1": 1},
      limit: 1
    }

    var criteria2 = null;

    var options2 = {
      fields: null,
      sort: {"field1": 1},
      limit: 2
    }

    publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/complex/' + test_path_end, complex_obj, null, function (e, put_result) {

      expect(e == null).to.be(true);
      publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/complex/' + test_path_end + '/1', complex_obj, null, function (e, put_result) {
        expect(e == null).to.be(true);

        ////////////console.log('searching');
        publisherclient.get('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/complex*', {
          criteria: criteria1,
          options: options1
        }, function (e, search_result) {

          ////////////console.log([e, search_result]);

          expect(e == null).to.be(true);
          expect(search_result.length == 1).to.be(true);

          publisherclient.get('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/complex*', {
            criteria: criteria2,
            options: options2
          }, function (e, search_result) {

            expect(e == null).to.be(true);
            expect(search_result.length == 2).to.be(true);

            callback(e);
          });

        });

      });

    });

  });


  it('should delete some test data', function (callback) {

    this.timeout(default_timeout);

    try {

      //We put the data we want to delete into the database
      publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {noPublish: true}, function (e, result) {

        //We perform the actual delete
        publisherclient.remove('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me', {noPublish: true}, function (e, result) {

          expect(e).to.be(null);
          expect(result._meta.status).to.be('ok');

          ////////////////////console.log('DELETE RESULT');
          ////////////////////console.log(result);

          callback();
        });

      });

    } catch (e) {
      callback(e);
    }

  });

  it('the publisher should set new data then update the data', function (callback) {

    this.timeout(default_timeout);

    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {noPublish: true}, function (e, insertResult) {

        expect(e).to.be(null);

        publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end, {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3',
          property4: 'property4'
        }, {noPublish: true}, function (e, updateResult) {

          expect(e).to.be(null);
          expect(updateResult._meta.id == insertResult._meta.id).to.be(true);
          callback();

        });

      });

    } catch (e) {
      callback(e);
    }
  });


  it('should tag some test data', function (callback) {

    var randomTag = require('shortid').generate();

    publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/test/tag', {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, {noPublish: true}, function (e, result) {

      ////////////////////console.log('did set');
      ////////////////////console.log([e, result]);

      if (e) return callback(e);

      publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/test/tag', null, {
        tag: randomTag,
        merge: true,
        noPublish: true
      }, function (e, result) {

        //console.log(e);

        if (e) return callback(e);

        ////////////////////console.log('merge tag results');
        ////////////////////console.log(e);
        ////////////////////console.log(result);

        expect(result.data.property1).to.be('property1');
        expect(result.data.property2).to.be('property2');
        expect(result.data.property3).to.be('property3');

        publisherclient.get('/_TAGS/a7_eventemitter_embedded_paths/' + test_id + '/test/tag/*', null, function (e, results) {

          expect(e).to.be(null);

          expect(results.length > 0).to.be(true);

          var found = false;

          results.map(function (tagged) {

            if (found)
              return;

            if (tagged._meta.tag == randomTag) {
              expect(tagged.data.property1).to.be('property1');
              expect(tagged.data.property2).to.be('property2');
              expect(tagged.data.property3).to.be('property3');
              found = true;
            }

          });

          if (!found)
            callback('couldn\'t find the tag snapshot');
          else
            callback();

        });


      });

    });

  });


//  We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

  it('the listener should pick up a single published event', function (callback) {

    this.timeout(default_timeout);

    try {

      //first listen for the change
      listenerclient.on('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event', {
        event_type: 'set',
        count: 1
      }, function (message) {

        expect(listenerclient.events['/SET@/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event'].length).to.be(0);
        callback();

      }, function (e) {

        //////////////////console.log('ON HAS HAPPENED: ' + e);

        if (!e) {

          expect(listenerclient.events['/SET@/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event'].length).to.be(1);
          //////////////////console.log('on subscribed, about to publish');

          //then make the change
          publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {
            ////////////////////////////console.log('put happened - listening for result');
          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });


//We are testing setting data at a specific path

  it('the publisher should set new data ', function (callback) {

    this.timeout(default_timeout);

    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, result) {

        if (!e) {
          publisherclient.get('a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end, null, function (e, results) {
            ////////////////////////console.log('new data results');
            ////////////////////////console.log(results);
            expect(results.property1 == 'property1').to.be(true);

            if (mode != 'embedded')
              expect(results.payload[0].created == results.payload[0].modified).to.be(true);

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


  it('the publisher should set new data then update the data', function (callback) {

    this.timeout(default_timeout);

    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, insertResult) {

        expect(e == null).to.be(true);

        publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end, {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3',
          property4: 'property4'
        }, null, function (e, updateResult) {

          expect(e == null).to.be(true);
          expect(updateResult._meta._id == insertResult._meta._id).to.be(true);
          callback();

        });

      });

    } catch (e) {
      callback(e);
    }
  });


//We are testing pushing a specific value to a path which will actually become an array in the database

  it('the publisher should push a sibling and get all siblings', function (callback) {

    this.timeout(default_timeout);

    try {

      var test_path_end = require('shortid').generate();

      publisherclient.setSibling('a7_eventemitter_embedded_paths/' + test_id + '/siblings/' + test_path_end, {
        property1: 'sib_post_property1',
        property2: 'sib_post_property2'
      }, function (e, results) {

        expect(e == null).to.be(true);

        publisherclient.setSibling('a7_eventemitter_embedded_paths/' + test_id + '/siblings/' + test_path_end, {
          property1: 'sib_post_property1',
          property2: 'sib_post_property2'
        }, function (e, results) {

          expect(e == null).to.be(true);

          //the child method returns a child in the collection with a specified id
          publisherclient.get('a7_eventemitter_embedded_paths/' + test_id + '/siblings/' + test_path_end + '/*', null, function (e, getresults) {
            expect(e == null).to.be(true);
            expect(getresults.length == 2).to.be(true);
            callback(e);
          });
        });
      });

    } catch (e) {
      callback(e);
    }
  });


//  We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

  it('the listener should pick up a single published event', function (callback) {

    this.timeout(default_timeout);

    try {

      //first listen for the change
      listenerclient.on('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event', {
        event_type: 'set',
        count: 1
      }, function (message) {

        expect(listenerclient.events['/SET@/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event'].length).to.be(0);
        callback();

      }, function (e) {

        if (!e) {

          expect(listenerclient.events['/SET@/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event'].length).to.be(1);

          ////////////////////////////console.log('on subscribed, about to publish');

          //then make the change
          publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {
            ////////////////////////////console.log('put happened - listening for result');
          });
        }
        else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });


  it('should get using a wildcard', function (callback) {

    var test_path_end = require('shortid').generate();

    publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, null, function (e, insertResult) {
      expect(e == null).to.be(true);
      publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end + '/1', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, insertResult) {
        expect(e == null).to.be(true);

        publisherclient.get('a7_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end + '*', null, function (e, results) {

          if (e) return callback();

          expect(results.length == 2).to.be(true);
          callback(e);

        });
      });
    });
  });

  it('should get paths', function (callback) {

    var test_path_end = require('shortid').generate();

    publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, null, function (e, insertResult) {
      expect(e == null).to.be(true);
      publisherclient.set('a7_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end + '/1', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, insertResult) {
        expect(e == null).to.be(true);

        publisherclient.getPaths('a7_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end + '*', function (e, results) {

          expect(results.length == 2).to.be(true);
          callback(e);

        });

      });
    });
  });


  it('the listener should pick up a single delete event', function (callback) {

    this.timeout(default_timeout);

    //We put the data we want to delete into the database
    publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me', {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, null, function (e, result) {

      //////////////////console.log('did delete set');
      //path, event_type, count, handler, done
      //We listen for the DELETE event
      listenerclient.on('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me', {
        event_type: 'remove',
        count: 1
      }, function (eventData) {

        ////console.log('on count 1 delete ');
        //////////////////console.log(message);

        //we are looking at the event internals on the listener to ensure our event management is working - because we are only listening for 1
        //instance of this event - the event listener should have been removed 
        ////console.log('listenerclient.events');
        ////console.log(listenerclient.events);
        expect(listenerclient.events['/REMOVE@/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me'].length).to.be(0);

        ////console.log(eventData);

        //we needed to have removed a single item
        expect(eventData.payload.removed).to.be(1);

        ////////////////////////////console.log(message);

        callback();

      }, function (e) {

        //console.log(e);

        ////////////console.log('ON HAS HAPPENED: ' + e);

        if (!e) return callback(e);

        ////console.log('listenerclient.events, pre');
        ////console.log(listenerclient.events);
        expect(listenerclient.events['/REMOVE@/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me'].length).to.be(1);

        //////////////////console.log('subscribed, about to delete');

        //We perform the actual delete
        publisherclient.remove('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me', null, function (e, result) {


          //////////////////console.log('REMOVE HAPPENED!!!');
          //////////////////console.log(e);
          //////////////////console.log(result);


          ////////////////////////////console.log('put happened - listening for result');
        });


      });
    });


  });

  it('should unsubscribe from an event', function (callback) {

    var currentListenerId;

    listenerclient.on('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/on_off_test', {
      event_type: 'set',
      count: 0
    }, function (message) {

      //we detach all listeners from the path here
      ////console.log('ABOUT OFF PATH');
      listenerclient.off('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/on_off_test', function (e) {

        if (e)
          return callback(new Error(e));

        listenerclient.on('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/on_off_test', {
            event_type: 'set',
            count: 0
          },
          function (message) {

            ////console.log('ON RAN');
            ////console.log(message);

            listenerclient.off(currentListenerId, function (e) {

              if (e)
                return callback(new Error(e));
              else
                return callback();

            });

          },
          function (e, listenerId) {
            if (e) return callback(new Error(e));

            currentListenerId = listenerId;

            publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/on_off_test', {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }, {}, function (e, setresult) {
              if (e) return callback(new Error(e));

              ////console.log('DID ON SET');
              ////console.log(setresult);
            });

          });

      });

    }, function (e, listenerId) {
      if (e) return callback(new Error(e));

      currentListenerId = listenerId;

      publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/on_off_test', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {}, function (e, setresult) {
        if (e) return callback(new Error(e));
      });
    });
  });

  it('should subscribe to the catch all notification', function (callback) {

    var caught = {};

    this.timeout(10000);
    var caughtCount = 0;

    listenerclient.onAll(function (eventData, meta) {

      if (meta.action == '/REMOVE@/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/catch_all' ||
        meta.action == '/SET@/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/catch_all')
        caughtCount++;

      if (caughtCount == 2)
        callback();

    }, function (e) {


      if (e) return callback(e);

      publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/catch_all', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, put_result) {

        publisherclient.remove('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/catch_all', null, function (e, del_result) {


        });

      });

    });

  });

  it('should unsubscribe from all events', function (callback) {
    this.timeout(10000);

    var onHappened = false;

    listenerclient.onAll(function (message) {

      onHappened = true;
      callback(new Error('this wasnt meant to happen'));

    }, function (e) {

      if (e) return callback(e);

      listenerclient.on('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/off_all_test', {
          event_type: 'set',
          count: 0
        },
        function (message) {
          onHappened = true;
          callback(new Error('this wasnt meant to happen'));
        },
        function (e) {
          if (e) return callback(e);

          listenerclient.offAll(function (e) {
            if (e) return callback(e);

            publisherclient.set('/a7_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/off_all_test', {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }, null, function (e, put_result) {
              if (e) return callback(e);

              setTimeout(function () {

                if (!onHappened)
                  callback();

              }, 3000);
            });
          });
        }
      );
    });
  });

})
;
