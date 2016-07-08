describe('c2_websockets_embedded_sanity_encryptedpayloads', function () {

  if (typeof window == 'undefined') {
    var chai = require('chai')
      , expect = chai.expect
      , happn = require('../../lib/index')
      , happn_client = happn.client
  }
  else {
    expect = window.expect;
    happn_client = window.HappnClient;
  }

  after(function (done) {

    if (socketClient) {
      socketClient.disconnect(done)
    }
    else done();

  });

  var socketClient;
  var default_timeout = 10000;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  before('should initialize the client', function (callback) {
    this.timeout(default_timeout);

    try {
      happn_client.create({
        config: {
          username: '_ADMIN',
          password: 'happn',
          keyPair: {
            publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
            privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
          }
        }
      }, function (e, instance) {

        if (e) return callback(e);

        socketClient = instance;
        callback();

      });
    } catch (e) {
      callback(e);
    }

  });

  //  We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

  it('the listener should pick up a single published event, eventemitter listening', function (callback) {

    this.timeout(default_timeout);

    try {

      //first listen for the change
      socketClient.on('/e2e_test1/testsubscribe/data/event', {event_type: 'set', count: 1}, function (message) {

        expect(socketClient.events['/SET@/e2e_test1/testsubscribe/data/event'].length).to.equal(0);
        callback();

      }, function (e) {

        //////////////////console.log('ON HAS HAPPENED: ' + e);

        if (!e) {

          expect(socketClient.events['/SET@/e2e_test1/testsubscribe/data/event'].length).to.equal(1);
          //////////////////console.log('on subscribed, about to publish');

          //then make the change
          socketClient.set('/e2e_test1/testsubscribe/data/event', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {
            ////////////////////////////console.log('put happened - listening for result');
          });
        } else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the listener should pick up a single published event, eventemitter publishing', function (callback) {

    this.timeout(default_timeout);

    try {

      //first listen for the change
      socketClient.on('/e2e_test1/testsubscribe/data/event', {event_type: 'set', count: 1}, function (message) {

        expect(socketClient.events['/SET@/e2e_test1/testsubscribe/data/event'].length).to.equal(0);
        callback();

      }, function (e) {

        //////////////////console.log('ON HAS HAPPENED: ' + e);

        if (!e) {

          expect(socketClient.events['/SET@/e2e_test1/testsubscribe/data/event'].length).to.equal(1);
          //////////////////console.log('on subscribed, about to publish');

          //then make the change
          socketClient.set('/e2e_test1/testsubscribe/data/event', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {
            ////////////////////////////console.log('put happened - listening for result');
          });

        } else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set new data ', function (callback) {

    this.timeout(default_timeout);

    try {
      var test_path_end = '1';

      socketClient.set('e2e_test1/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {noPublish: true}, function (e, result) {

        ////////////console.log('set happened');
        ////////////console.log([e, result]);

        if (!e) {
          socketClient.get('e2e_test1/testsubscribe/data/' + test_path_end, null, function (e, results) {
            ////////////console.log('new data results');
            ////////////console.log([e, results]);

            expect(results.property1 == 'property1').to.equal(true);
            expect(results.created == results.modified).to.equal(true);

            callback(e);
          });
        } else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('should set data, and then merge a new document into the data without overwriting old fields', function (callback) {

    this.timeout(default_timeout);

    try {

      var test_path_end = '2';

      socketClient.set('e2e_test1/testsubscribe/data/merge/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, result) {

        if (e)
          return callback(e);

        //////////////console.log('set results');
        //////////////console.log(result);

        socketClient.set('e2e_test1/testsubscribe/data/merge/' + test_path_end, {property4: 'property4'}, {merge: true}, function (e, result) {

          if (e)
            return callback(e);

          //////////////console.log('merge set results');
          //////////////console.log(result);

          socketClient.get('e2e_test1/testsubscribe/data/merge/' + test_path_end, null, function (e, results) {

            if (e)
              return callback(e);

            //////////////console.log('merge get results');
            //////////////console.log(results);

            expect(results.property4).to.equal('property4');
            expect(results.property1).to.equal('property1');

            callback();

          });

        });

      });

    } catch (e) {
      callback(e);
    }
  });

  it('should search for a complex object', function (callback) {

    //////////////////////////console.log('DOING COMPLEX SEARCH');

    var test_path_end = '3';

    var complex_obj = {
      regions: ['North', 'South'],
      towns: ['North.Cape Town'],
      categories: ['Action', 'History'],
      subcategories: ['Action.angling', 'History.art'],
      keywords: ['bass', 'Penny Siopis'],
      field1: 'field1'
    };


    var criteria1 = {
      $or: [{"regions": {$in: ['North', 'South', 'East', 'West']}},
        {"towns": {$in: ['North.Cape Town', 'South.East London']}},
        {"categories": {$in: ["Action", "History"]}}],
      "keywords": {$in: ["bass", "Penny Siopis"]}
    }

    var options1 = {
      fields: {"data": 1},
      sort: {"field1": 1},
      limit: 1
    }

    var criteria2 = null;

    var options2 = {
      fields: null,
      sort: {"field1": 1},
      limit: 2
    }

    socketClient.set('/e2e_test1/testsubscribe/data/complex/' + test_path_end, complex_obj, null, function (e, put_result) {
      expect(e == null).to.equal(true);
      socketClient.set('/e2e_test1/testsubscribe/data/complex/' + test_path_end + '/1', complex_obj, null, function (e, put_result) {
        expect(e == null).to.equal(true);

        ////////////console.log('searching');
        socketClient.get('/e2e_test1/testsubscribe/data/complex*', {
          criteria: criteria1,
          options: options1
        }, function (e, search_result) {

          ////////////console.log([e, search_result]);

          expect(e == null).to.equal(true);
          expect(search_result.length == 1).to.equal(true);

          socketClient.get('/e2e_test1/testsubscribe/data/complex*', {
            criteria: criteria2,
            options: options2
          }, function (e, search_result) {

            expect(e == null).to.equal(true);
            expect(search_result.length == 2).to.equal(true);

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
      socketClient.set('/e2e_test1/testsubscribe/data/delete_me', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {noPublish: true}, function (e, result) {

        //We perform the actual delete
        socketClient.remove('/e2e_test1/testsubscribe/data/delete_me', {noPublish: true}, function (e, result) {

          expect(e).to.equal(null);
          expect(result._meta.status).to.equal('ok');

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
      var test_path_end = '4';

      socketClient.set('e2e_test1/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {noPublish: true}, function (e, insertResult) {

        expect(e).to.equal(null);

        socketClient.set('e2e_test1/testsubscribe/data/' + test_path_end, {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3',
          property4: 'property4'
        }, {noPublish: true}, function (e, updateResult) {

          expect(e).to.equal(null);
          expect(updateResult._id == insertResult._id).to.equal(true);
          callback();

        });

      });

    } catch (e) {
      callback(e);
    }
  });


  //We are testing setting data at a specific path

  it('the publisher should set new data ', function (callback) {

    this.timeout(default_timeout);

    try {
      var test_path_end = '5';

      socketClient.set('e2e_test1/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, result) {

        if (!e) {
          socketClient.get('e2e_test1/testsubscribe/data/' + test_path_end, null, function (e, results) {
            ////////////////////////console.log('new data results');
            ////////////////////////console.log(results);

            expect(results.property1 == 'property1').to.equal(true);

            // if (mode != 'embedded')
            //  expect(results.payload[0].created == results.payload[0].modified).to.equal(true);

            callback(e);
          });
        } else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });


  it('the publisher should set new data then update the data', function (callback) {

    this.timeout(default_timeout);

    try {
      var test_path_end = '6';

      socketClient.set('e2e_test1/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, insertResult) {

        expect(e == null).to.equal(true);

        socketClient.set('e2e_test1/testsubscribe/data/' + test_path_end, {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3',
          property4: 'property4'
        }, null, function (e, updateResult) {

          expect(e == null).to.equal(true);
          expect(updateResult._id == insertResult._id).to.equal(true);
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

      var test_path_end = '7';

      socketClient.setSibling('e2e_test1/siblings/' + test_path_end, {
        property1: 'sib_post_property1',
        property2: 'sib_post_property2'
      }, function (e, results) {

        expect(e == null).to.equal(true);

        socketClient.setSibling('e2e_test1/siblings/' + test_path_end, {
          property1: 'sib_post_property1',
          property2: 'sib_post_property2'
        }, function (e, results) {

          expect(e == null).to.equal(true);

          //the child method returns a child in the collection with a specified id
          socketClient.get('e2e_test1/siblings/' + test_path_end + '/*', null, function (e, getresults) {
            expect(e == null).to.equal(true);
            expect(getresults.length == 2).to.equal(true);
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
      socketClient.on('/e2e_test1/testsubscribe/data/event', {event_type: 'set', count: 1}, function (message) {

        expect(socketClient.events['/SET@/e2e_test1/testsubscribe/data/event'].length).to.equal(0);
        callback();

      }, function (e) {

        if (!e) {

          expect(socketClient.events['/SET@/e2e_test1/testsubscribe/data/event'].length).to.equal(1);

          ////////////////////////////console.log('on subscribed, about to publish');

          //then make the change
          socketClient.set('/e2e_test1/testsubscribe/data/event', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {
            ////////////////////////////console.log('put happened - listening for result');
          });
        } else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });


  it('should get using a wildcard', function (callback) {

    var test_path_end = '8';

    socketClient.set('e2e_test1/testwildcard/' + test_path_end, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, null, function (e, insertResult) {
      expect(e == null).to.equal(true);
      socketClient.set('e2e_test1/testwildcard/' + test_path_end + '/1', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, insertResult) {
        expect(e == null).to.equal(true);

        socketClient.get('e2e_test1/testwildcard/' + test_path_end + '*', null, function (e, results) {

          expect(results.length == 2).to.equal(true);

          socketClient.getPaths('e2e_test1/testwildcard/' + test_path_end + '*', function (e, results) {

            expect(results.length == 2).to.equal(true);
            callback(e);

          });
        });
      });
    });
  });

  it('the listener should pick up a single delete event', function (callback) {

    this.timeout(default_timeout);

    try {

      //We put the data we want to delete into the database
      socketClient.set('/e2e_test1/testsubscribe/data/delete_me', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, result) {

        //////////////////console.log('did delete set');
        //path, event_type, count, handler, done
        //We listen for the DELETE event
        socketClient.on('/e2e_test1/testsubscribe/data/delete_me', {
          event_type: 'remove',
          count: 1
        }, function (eventData) {

          ////console.log('on count 1 delete ');
          //////////////////console.log(message);

          //we are looking at the event internals on the listener to ensure our event management is working - because we are only listening for 1
          //instance of this event - the event listener should have been removed
          ////console.log('socketClient.events');
          ////console.log(socketClient.events);
          expect(socketClient.events['/REMOVE@/e2e_test1/testsubscribe/data/delete_me'].length).to.equal(0);

          ////console.log(eventData);

          //we needed to have removed a single item
          expect(eventData.removed).to.equal(1);

          ////////////////////////////console.log(message);

          callback();

        }, function (e) {

          ////////////console.log('ON HAS HAPPENED: ' + e);

          if (!e) {
            ////console.log('socketClient.events, pre');
            ////console.log(socketClient.events);
            expect(socketClient.events['/REMOVE@/e2e_test1/testsubscribe/data/delete_me'].length).to.equal(1);

            //////////////////console.log('subscribed, about to delete');

            //We perform the actual delete
            socketClient.remove('/e2e_test1/testsubscribe/data/delete_me', null, function (e, result) {


              //////////////////console.log('REMOVE HAPPENED!!!');
              //////////////////console.log(e);
              //////////////////console.log(result);


              ////////////////////////////console.log('put happened - listening for result');
            });
          } else
            callback(e);
        });
      });


    } catch (e) {
      callback(e);
    }
  });

  it('should unsubscribe from an event', function (callback) {

    var currentListenerId;

    socketClient.on('/e2e_test1/testsubscribe/data/on_off_test', {event_type: 'set', count: 0}, function (message) {

      //we detach all listeners from the path here
      ////console.log('ABOUT OFF PATH');
      socketClient.off('/e2e_test1/testsubscribe/data/on_off_test', function (e) {

        if (e)
          return callback(new Error(e));

        socketClient.on('/e2e_test1/testsubscribe/data/on_off_test', {event_type: 'set', count: 0},
          function (message) {

            ////console.log('ON RAN');
            ////console.log(message);

            socketClient.off(currentListenerId, function (e) {

              if (e)
                return callback(new Error(e));
              else
                return callback();

            });

          },
          function (e, listenerId) {
            if (e) return callback(new Error(e));

            currentListenerId = listenerId;

            socketClient.set('/e2e_test1/testsubscribe/data/on_off_test', {
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

      socketClient.set('/e2e_test1/testsubscribe/data/on_off_test', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {}, function (e, setresult) {
        if (e) return callback(new Error(e));
      });
    });
  });

  var caughtCount = 0;
  it('should subscribe to the catch all notification', function (callback) {

    var caught = {};

    this.timeout(10000);

    socketClient.onAll(function (eventData, meta) {

      if (meta.action == '/REMOVE@/e2e_test1/testsubscribe/data/catch_all' ||
        meta.action == '/SET@/e2e_test1/testsubscribe/data/catch_all')
        caughtCount++;

      if (caughtCount == 2)
        callback();

    }, function (e) {

      if (e) return callback(e);

      socketClient.set('/e2e_test1/testsubscribe/data/catch_all', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, put_result) {

        //console.log('put_result', put_result);

        socketClient.remove('/e2e_test1/testsubscribe/data/catch_all', null, function (e, del_result) {
          //console.log('del_result', del_result);
        });

      });

    });

  });

  it('should unsubscribe from all events', function (callback) {
    this.timeout(10000);

    var onHappened = false;

    socketClient.onAll(function (message) {

      onHappened = true;
      callback(new Error('this wasnt meant to happen'));

    }, function (e) {

      if (e) return callback(e);

      socketClient.on('/e2e_test1/testsubscribe/data/off_all_test', {event_type: 'set', count: 0},
        function (message) {
          onHappened = true;
          callback(new Error('this wasnt meant to happen'));
        },
        function (e) {
          if (e) return callback(e);

          socketClient.offAll(function (e) {
            if (e) return callback(e);

            socketClient.set('/e2e_test1/testsubscribe/data/off_all_test', {
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

});
