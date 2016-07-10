describe('7_websockets_security_benchmarks', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../../lib/index');
  var service = happn.service;
  var async = require('async');
  var happn_client = happn.client;
  var HAPPNER_STOP_DELAY = 5000;

  var test_secret = 'test_secret';
  var mode = "embedded";
  var default_timeout = 5000;
  var happnInstance = null;

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  before('should initialize the service', function (callback) {

    this.timeout(20000);

    try {
      service.create({
          secure: true,
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
              path: './services/pubsub/service.js'
            }
          },
          utils: {
            log_level: 'info|error|warning',
            log_component: 'prepare'
          }
        },
        function (e, instance) {
          if (e) return callback(e);
          happnInstance = instance;
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
  it('should initialize the clients', function (callback) {
    this.timeout(default_timeout);

    try {
      happn_client.create({
        config: {username: '_ADMIN', password: 'happn'},
        secure: true
      }, function (e, instance) {

        if (e) return callback(e);

        publisherclient = instance;
        happn_client.create({
          config: {username: '_ADMIN', password: 'happn'},
          secure: true
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


  it('should handle sequences of events by writing as soon as possible -slow?', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
      config: {username: '_ADMIN', password: 'happn'},
      secure: true
    }, function (e, stressTestClient) {
      if (e) return callback(e);

      var count = 0;
      var expected = 1000;
      var receivedCount = 0;
      var timerName = expected + 'Events - no wait';

      var writeData = function () {
        if (count == expected) return;

        publisherclient.set('/e2e_test1/testsubscribe/sequence5', {
          property1: count++
        }, {excludeId: true}, function (e, result) {
          writeData();
        });
      }

      stressTestClient.on('/e2e_test1/testsubscribe/sequence5', {event_type: 'set', count: 0}, function (message) {

        receivedCount++;

        if (receivedCount == expected) {
          console.timeEnd(timerName);
          callback();
        }

      }, function (e) {
        if (!e) {
          console.time(timerName);
          writeData();
        }
        else
          callback(e);
      });
    });
  });

  it('should handle sequences of events by when the previous one is done, without storing', function (callback) {

    this.timeout(default_timeout);

    var count = 0;
    var expected = 1000;
    var receivedCount = 0;
    var timerName = expected + 'Events - no store';

    var writeData = function () {

      if (receivedCount == expected) return;

      publisherclient.set('/e2e_test1/testsubscribe/sequence3', {
          property1: receivedCount
        }, {noStore: true},
        function (e, result) {
          if (e)
            return callback(e);

        });
    }

    //first listen for the change
    listenerclient.on('/e2e_test1/testsubscribe/sequence3', {event_type: 'set', count: 0}, function (message) {

      receivedCount++;

      if (receivedCount == expected) {
        console.timeEnd(timerName);
        callback();
      } else
        writeData();

    }, function (e) {

      if (!e) {

        //then make the change
        console.time(timerName);
        writeData();
      }
      else
        callback(e);

    });

  });


  it('should handle sequences of events by writing each one after each other asap, without storing', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
      config: {username: '_ADMIN', password: 'happn'},
      secure: true
    }, function (e, stressTestClient) {

      if (e) return callback(e);

      var count = 0;
      var expected = 1000;
      var receivedCount = 0;
      var timerName = expected + 'Events - no wait - no store';

      //first listen for the change
      stressTestClient.on('/e2e_test1/testsubscribe/sequence1', {event_type: 'set', count: 0}, function (message) {

        receivedCount++;

        if (receivedCount == expected) {
          console.timeEnd(timerName);

          callback();
        }

      }, function (e) {

        if (!e) {

          console.time(timerName);

          function writeData() {

            if (count == expected) {
              return;
            }

            publisherclient.set('/e2e_test1/testsubscribe/sequence1', {
              property1: count++
            }, {noStore: true}, function (e, result) {
              writeData();
            });
          }

          writeData();

        }
        else
          callback(e);
      });

    });

  });


  it('should handle sequences of events by writing as soon as possible - not persisting, using noStore - and ensure the events push the correct data values back', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
      config: {username: '_ADMIN', password: 'happn'},
      secure: true
    }, function (e, stressTestClient) {

      if (e) return callback(e);
      setTimeout(function () {

        var count = 0;
        var expected = 1000;
        var receivedCount = 0;

        var received = {};
        var sent = [expected];


        for (var i = 0; i < expected; i++) {
          sent[i] = require('shortid').generate();
        }

        //first listen for the change
        stressTestClient.on('/e2e_test1/testsubscribe/sequence_nostore', {
          event_type: 'set',
          count: 0
        }, function (message) {

          //////////////console.log('Event happened', message);

          if (e)
            return callback(e);

          receivedCount++;

          if (received[message.property1])
            received[message.property1] = received[message.property1] + 1;
          else
            received[message.property1] = 1;

          if (receivedCount == sent.length) {
            console.timeEnd('timeTest1');
            expect(Object.keys(received).length == expected).to.be(true);
            //////////////console.log(received);

            callback();
          }

        }, function (e) {

          //////////////console.log('ON HAS HAPPENED: ' + e);

          if (!e) {

            expect(stressTestClient.events['/SET@/e2e_test1/testsubscribe/sequence_nostore'].length).to.be(1);
            console.time('timeTest1');

            while (count < expected) {

              publisherclient.set('/e2e_test1/testsubscribe/sequence_nostore', {
                property1: sent[count]
              }, {noStore: true}, function (e, result) {

                if (e)
                  return callback(e);

              });

              count++;
            }

          }
          else
            callback(e);
        });

      }, 2000)
    });
  });

  it('should handle sequences of events by writing as soon as possible - not persisting, using noStore, fire and forget - and ensure the events push the correct data values back', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
      config: {username: '_ADMIN', password: 'happn'},
      secure: true
    }, function (e, stressTestClient) {

      if (e) return callback(e);
      setTimeout(function () {

        var count = 0;
        var expected = 1000;
        var receivedCount = 0;

        var received = {};
        var sent = [expected];


        for (var i = 0; i < expected; i++) {
          sent[i] = require('shortid').generate();
        }

        //first listen for the change
        stressTestClient.on('/e2e_test1/testsubscribe/sequence_nostore_fireforget', {
          event_type: 'set',
          count: 0
        }, function (message) {

          receivedCount++;

          if (received[message.property1])
            received[message.property1] = received[message.property1] + 1;
          else
            received[message.property1] = 1;

          if (receivedCount == sent.length) {
            console.timeEnd('timeTest1');
            expect(Object.keys(received).length == expected).to.be(true);

            callback();
          }

        }, function (e) {

          if (!e) {

            expect(stressTestClient.events['/SET@/e2e_test1/testsubscribe/sequence_nostore_fireforget'].length).to.be(1);
            console.time('timeTest1');

            while (count < expected) {

              publisherclient.set('/e2e_test1/testsubscribe/sequence_nostore_fireforget', {
                property1: sent[count]
              }, {noStore: true});

              count++;
            }

          }
          else
            callback(e);
        });

      }, 2000)
    });
  });

  it('should handle sequences of events by writing as soon as possible - persisting, and ensure the events push the correct data values back', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
      config: {username: '_ADMIN', password: 'happn'},
      secure: true
    }, function (e, stressTestClient) {
      if (e) return callback(e);

      var count = 0;
      var expected = 1000;
      var receivedCount = 0;

      var received = {};
      var sent = [expected];

      for (var i = 0; i < expected; i++) {
        sent[i] = require('shortid').generate();
      }

      //first listen for the change
      stressTestClient.on('/e2e_test1/testsubscribe/sequence_persist', {
        event_type: 'set',
        count: 0
      }, function (message) {

        receivedCount++;

        if (received[message.property1])
          received[message.property1] = received[message.property1] + 1;
        else
          received[message.property1] = 1;

        if (receivedCount == sent.length) {
          console.timeEnd('timeTest1');
          expect(Object.keys(received).length == expected).to.be(true);

          callback();
        }

      }, function (e) {

        if (!e) {

          expect(stressTestClient.events['/SET@/e2e_test1/testsubscribe/sequence_persist'].length).to.be(1);
          console.time('timeTest1');

          while (count < expected) {

            publisherclient.set('/e2e_test1/testsubscribe/sequence_persist', {
              property1: sent[count]
            }, {excludeId: true}, function (e, result) {

              if (e)
                return callback(e);


            });

            count++;
          }

        }
        else
          callback(e);
      });
    });
  });

  it('should handle sequences of events by writing as soon as possible', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
      config: {username: '_ADMIN', password: 'happn'},
      secure: true
    }, function (e, stressTestClient) {

      if (e) return callback(e);
      var count = 0;
      var expected = 1000;
      var receivedCount = 0;
      var timerName = expected + 'Events - no wait';

      stressTestClient.on('/e2e_test1/testsubscribe/sequence4', {event_type: 'set', count: 0}, function (message) {

        receivedCount++;

        if (receivedCount == expected) {
          console.timeEnd(timerName);
          callback();
        }

      }, function (e) {
        if (!e) {
          console.time(timerName);
          writeData();
        }
        else
          callback(e);
      });

      function writeData() {

        if (count == expected) return;

        publisherclient.set('/e2e_test1/testsubscribe/sequence4', {
          property1: count++
        }, {excludeId: true}, function (e, result) {
          writeData();
        });
      }

    });


  });

  it('should handle sequences of events by when the previous one is done', function (callback) {

    this.timeout(default_timeout);

    var count = 0;
    var expected = 1000;
    var receivedCount = 0;
    var timerName = expected + 'Events';

    listenerclient.on('/e2e_test1/testsubscribe/sequence32', {event_type: 'set', count: 0}, function (message) {

      receivedCount++;

      if (receivedCount == expected) {
        console.timeEnd(timerName);
        callback();
      }

    }, function (e) {
      if (!e) {
        console.time(timerName);
        writeData();
      }
      else
        callback(e);
    });

    function writeData() {

      if (count == expected) return;

      publisherclient.set('/e2e_test1/testsubscribe/sequence32', {
        property1: count++
      }, {excludeId: true}, function (e, result) {
        writeData();
      });
    }

  });

  it('should handle sequences of events by writing as soon as possible -slow?', function (callback) {

    this.timeout(10000);

    happn_client.create({
      config: {username: '_ADMIN', password: 'happn'},
      secure: true
    }, function (e, stressTestClient) {
      if (e) return callback(e);

      var count = 0;
      var expected = 1000;
      var receivedCount = 0;
      var timerName = expected + 'Events - no wait';

      var writeData = function () {
        if (count == expected) return;

        publisherclient.set('/e2e_test1/testsubscribe/sequence5', {
          property1: count++
        }, {excludeId: true}, function (e, result) {
          writeData();
        });
      }

      stressTestClient.on('/e2e_test1/testsubscribe/sequence5', {event_type: 'set', count: 0}, function (message) {

        receivedCount++;

        if (receivedCount == expected) {
          console.timeEnd(timerName);
          callback();
        }

      }, function (e) {
        if (!e) {
          console.time(timerName);
          writeData();
        }
        else
          callback(e);
      });

    });

  });

  it('should handle sequences of events by when the previous one is done', function (callback) {

    this.timeout(default_timeout);

    var count = 0;
    var expected = 1000;
    var receivedCount = 0;
    var timerName = expected + 'Events';

    listenerclient.on('/e2e_test1/testsubscribe/sequence31', {event_type: 'set', count: 0}, function (message) {

      receivedCount++;

      if (receivedCount == expected) {
        console.timeEnd(timerName);
        callback();
      }

    }, function (e) {

      function writeData() {

        if (count == expected) return;

        publisherclient.set('/e2e_test1/testsubscribe/sequence31', {
          property1: count++
        }, {excludeId: true}, function (e, result) {
          writeData();
        });
      }

      if (!e) {
        console.time(timerName);
        writeData();
      }
      else
        callback(e);
    });

  });

  it('should handle sequences of events by writing as soon as possible -slow?', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
      config: {username: '_ADMIN', password: 'happn'},
      secure: true
    }, function (e, stressTestClient) {
      if (e) return callback(e);

      var count = 0;
      var expected = 1000;
      var receivedCount = 0;
      var timerName = expected + 'Events - no wait';

      var writeData = function () {
        if (count == expected) return;

        publisherclient.set('/e2e_test1/testsubscribe/sequence5', {
          property1: count++
        }, {excludeId: true}, function (e, result) {
          writeData();
        });
      }

      stressTestClient.on('/e2e_test1/testsubscribe/sequence5', {event_type: 'set', count: 0}, function (message) {

        receivedCount++;

        if (receivedCount == expected) {
          console.timeEnd(timerName);
          callback();
        }

      }, function (e) {
        if (!e) {
          console.time(timerName);
          writeData();
        }
        else
          callback(e);
      });
    });
  });

  require('benchmarket').stop();

});
