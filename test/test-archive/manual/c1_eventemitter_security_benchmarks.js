/*

 ## To write to the benchmark csv

 ```bash


 mocha test/c1_eventemitter_security_benchmarks.js.js | grep ^CSV | awk 'END {print ""} {printf "%i %s,", $2, $NF}' >> test/c1_eventemitter_security_benchmarks.js.csv


 ```

 To also see it.

 nother console

 ```
 tail -f test/.e2e_eventemitter_embedded_benchmarks.csv
 ```

 */
var expect = require('expect.js');
var happn = require('../../lib/index');
var service = happn.service;
var happn_client = happn.client;
var async = require('async');
var HAPPNER_STOP_DELAY = 5000;

describe('c1_eventemitter_security_benchmarks.js', function () {

  var testport = 8000;
  var test_secret = 'test_secret';
  var mode = "embedded";
  var default_timeout = 100000;
  var happnInstance = null;

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

    this.timeout(HAPPNER_STOP_DELAY + 5000);

    happnInstance.stop(function (e) {
      setTimeout(function () {
        done(e);
      }, HAPPNER_STOP_DELAY)
    });
  });

  var publisherclient;
  var listenerclient;

  it('should initialize the clients', function (callback) {
    this.timeout(default_timeout);

    try {

      happn_client.create({
        config: {username: '_ADMIN', password: 'happn'},
        secure: true,
        plugin: happn.client_plugins.intra_process,
        context: happnInstance
      }, function (e, instance) {

        if (e) return callback(e);

        publisherclient = instance;

        happn_client.create({
          config: {username: '_ADMIN', password: 'happn'},
          secure: true,
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

  it('should handle sequences of events by writing as soon as possible -slow?', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
        config: {username: '_ADMIN', password: 'happn'},
        plugin: happn.client_plugins.intra_process,
        context: happnInstance,
        secure: true,
      },
      function (e, stressTestClient) {

        if (e) return callback(e);

        var count = 0;
        var expected = 1000;
        var receivedCount = 0;
        var timerName = 'CSV.colm 1 ' + expected + 'Events - no wait';

        var writeData = function () {
          if (count == expected) return;

          publisherclient.set('/e2e_test1/testsubscribe/sequence5', {
            property1: count++
          }, {
            excludeId: true
          }, function (e, result) {
            writeData();
          });
        }

        stressTestClient.on('/e2e_test1/testsubscribe/sequence5', {
            event_type: 'set',
            count: 0
          }, function (message) {
            receivedCount++;
            if (receivedCount == expected) {
              console.timeEnd(timerName);
              callback();
            }
          },
          function (e) {
            if (!e) {
              console.time(timerName);
              writeData();
            } else
              callback(e);

          });
      });
  });

  it('should handle sequences of events by when the previous one is done, without storing', function (callback) {

    this.timeout(default_timeout);

    var count = 0;
    var expected = 1000;
    var receivedCount = 0;
    var timerName = 'CSV.colm 2 ' + expected + 'Events - no store';

    var writeData = function () {

      if (receivedCount == expected) return;

      ////////console.log('putting data: ', count);
      publisherclient.set('/e2e_test1/testsubscribe/sequence3', {
          property1: receivedCount
        }, {
          noStore: true
        },
        function (e, result) {
          if (e)
            return callback(e);

          //////console.log('put data: ', result);
        });
    }
    //path, event_type, count, handler, done
    //first listen for the change
    listenerclient.on('/e2e_test1/testsubscribe/sequence3', {
      event_type: 'set',
      count: 0
    }, function (message) {

      receivedCount++;

      if (receivedCount == expected) {
        console.timeEnd(timerName);
        callback();
      } else
        writeData();

    }, function (e) {

      if (!e) {
        console.time(timerName);
        writeData();
      } else
        callback(e);

    });

  });


  it('should handle sequences of events by writing each one after each other asap, without storing', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
        config: {username: '_ADMIN', password: 'happn'},
        plugin: happn.client_plugins.intra_process,
        context: happnInstance,
        secure: true,
      },
      function (e, stressTestClient) {

        if (e) return callback(e);

        var count = 0;
        var expected = 1000;
        var receivedCount = 0;
        var timerName = 'CSV.colm 3 ' + expected + 'Events - no wait - no store';

        stressTestClient.on('/e2e_test1/testsubscribe/sequence1', {
            event_type: 'set',
            count: 0
          },
          function (message) {
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
                }, {
                  noStore: true
                }, function (e, result) {
                  writeData();
                });
              }

              writeData();

            } else
              callback(e);
          });

      });

  });

  it('should handle sequences of events by writing each one after each other asap, without storing - deferring setImmediate every 100', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
        config: {username: '_ADMIN', password: 'happn'},
        plugin: happn.client_plugins.intra_process,
        context: happnInstance,
        secure: true,
      },
      function (e, stressTestClient) {

        if (e) return callback(e);

        var count = 0;
        var expected = 1000;
        var receivedCount = 0;
        var timerName = 'CSV.colm 3 ' + expected + 'Events - no wait - no store';

        stressTestClient.on('/e2e_test1/testsubscribe/sequence1', {
            event_type: 'set',
            count: 0,
            config: {
              deferSetImmediate: 100
            }
          }, function (message, meta) {

            ////console.log(message, meta);

            receivedCount++;

            if (receivedCount == expected) {
              console.timeEnd(timerName);
              callback();
            }

          },
          function (e) {
            if (!e) {
              console.time(timerName);

              function writeData() {

                if (count == expected) {
                  return;
                }

                publisherclient.set('/e2e_test1/testsubscribe/sequence1', {
                  property1: count++
                }, {
                  noStore: true
                }, function (e, result) {
                  writeData();
                });
              }

              writeData();

            } else
              callback(e);
          });

      });

  });


  it('should handle sequences of events by writing as soon as possible - not persisting, using noStore - and ensure the events push the correct data values back', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
        config: {username: '_ADMIN', password: 'happn'},
        plugin: happn.client_plugins.intra_process,
        context: happnInstance,
        secure: true,
      },
      function (e, stressTestClient) {

        if (e) return callback(e);
        setTimeout(function () {

          var count = 0;
          var expected = 1000;
          var timerName = 'CSV.colm 4 testTime1';
          var receivedCount = 0;

          var received = {};
          var sent = [expected];


          for (var i = 0; i < expected; i++) {
            sent[i] = require('shortid').generate();
          }

          stressTestClient.on('/e2e_test1/testsubscribe/sequence_nostore', {
              event_type: 'set',
              count: 0
            },
            function (message) {

              receivedCount++;

              if (received[message.property1])
                received[message.property1] = received[message.property1] + 1;
              else
                received[message.property1] = 1;

              if (receivedCount == sent.length) {
                console.timeEnd(timerName);
                expect(Object.keys(received).length == expected).to.be(true);

                callback();
              }

            },
            function (e) {

              if (!e) {

                expect(stressTestClient.events['/SET@/e2e_test1/testsubscribe/sequence_nostore'].length).to.be(1);
                console.time(timerName);

                while (count < expected) {

                  publisherclient.set('/e2e_test1/testsubscribe/sequence_nostore', {
                    property1: sent[count]
                  }, {
                    noStore: true
                  }, function (e, result) {

                    if (e)
                      return callback(e);

                  });

                  count++;
                }

              } else callback(e);

            });

        }, 2000)
      });
  });

  it('should handle sequences of events by writing as soon as possible - persisting, and ensure the events push the correct data values back', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
        config: {username: '_ADMIN', password: 'happn'},
        plugin: happn.client_plugins.intra_process,
        context: happnInstance,
        secure: true,
      },
      function (e, stressTestClient) {

        if (e) return callback(e);

        var count = 0;
        var timerName = 'CSV.colm 5 testTime2';
        var expected = 1000;
        var receivedCount = 0;

        var received = {};
        var sent = [];

        for (var i = 0; i < expected; i++) {
          sent[i] = require('shortid').generate();
        }

        stressTestClient.on('/e2e_test1/testsubscribe/sequence_persist', {event_type: 'set', count: 0},
          function (message) {

            ////console.log(message);

            receivedCount++;

            if (received[message.property1])
              received[message.property1] = received[message.property1] + 1;
            else
              received[message.property1] = 1;

            if (receivedCount == sent.length) {
              console.timeEnd(timerName);

              ////console.log(received);

              expect(Object.keys(received).length == expected).to.be(true);
              callback();
            }
          },
          function (e) {

            if (e) return callback(e);

            expect(stressTestClient.events['/SET@/e2e_test1/testsubscribe/sequence_persist'].length).to.be(1);
            console.time(timerName);

            while (count < expected) {

              publisherclient.set('/e2e_test1/testsubscribe/sequence_persist', {property1: sent[count]}, {},
                function (e, result) {
                  if (e) return callback(e);
                });

              count++;
            }
          });
      });
  });

  it('should handle sequences of events by writing as soon as possible', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
        config: {username: '_ADMIN', password: 'happn'},
        plugin: happn.client_plugins.intra_process,
        context: happnInstance,
        secure: true,
      },
      function (e, stressTestClient) {

        if (e) return callback(e);
        var count = 0;
        var expected = 1000;
        var receivedCount = 0;
        var timerName = 'CSV.colm 6 ' + expected + 'Events - no wait';

        stressTestClient.on('/e2e_test1/testsubscribe/sequence4', {
          event_type: 'set',
          count: 0
        }, function (message) {

          receivedCount++;

          if (receivedCount == expected) {
            console.timeEnd(timerName);
            callback();
          }

        }, function (e) {
          if (!e) {
            console.time(timerName);
            writeData();
          } else
            callback(e);
        });

        function writeData() {

          if (count == expected) return;

          publisherclient.set('/e2e_test1/testsubscribe/sequence4', {
            property1: count++
          }, {
            excludeId: true
          }, function (e, result) {
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
    var timerName = 'CSV.colm 7 ' + expected + 'Events';

    listenerclient.on('/e2e_test1/testsubscribe/sequence32', {
      event_type: 'set',
      count: 0
    }, function (message) {


      receivedCount++;

      if (receivedCount == expected) {
        console.timeEnd(timerName);
        callback();
      }

    }, function (e) {
      if (!e) {
        console.time(timerName);
        writeData();
      } else
        callback(e);
    });

    function writeData() {

      if (count == expected) return;

      publisherclient.set('/e2e_test1/testsubscribe/sequence32', {
        property1: count++
      }, {
        excludeId: true
      }, function (e, result) {
        writeData();
      });
    }

  });

  it('should handle sequences of events by writing as soon as possible -slow?', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
        config: {username: '_ADMIN', password: 'happn'},
        plugin: happn.client_plugins.intra_process,
        context: happnInstance,
        secure: true,
      },
      function (e, stressTestClient) {
        if (e) return callback(e);

        var count = 0;
        var expected = 1000;
        var receivedCount = 0;
        var timerName = 'CSV.colm 8 ' + expected + 'Events - no wait';

        var writeData = function () {
          if (count == expected) return;

          publisherclient.set('/e2e_test1/testsubscribe/sequence5', {
            property1: count++
          }, {
            excludeId: true
          }, function (e, result) {
            writeData();
          });
        }

        stressTestClient.on('/e2e_test1/testsubscribe/sequence5', {
          event_type: 'set',
          count: 0
        }, function (message) {


          receivedCount++;

          if (receivedCount == expected) {
            console.timeEnd(timerName);
            callback();
          }

        }, function (e) {
          if (!e) {
            console.time(timerName);
            writeData();
          } else
            callback(e);
        });

      });

  });

  it('should handle sequences of events by when the previous one is done', function (callback) {

    this.timeout(default_timeout);

    var count = 0;
    var expected = 1000;
    var receivedCount = 0;
    var timerName = 'CSV.colm 9 ' + expected + 'Events';

    listenerclient.on('/e2e_test1/testsubscribe/sequence31', {
      event_type: 'set',
      count: 0
    }, function (message) {

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
        }, {
          excludeId: true
        }, function (e, result) {
          writeData();
        });
      }

      if (!e) {
        console.time(timerName);
        writeData();
      } else
        callback(e);
    });

  });

  it('should handle sequences of events by writing as soon as possible -slow?', function (callback) {

    this.timeout(default_timeout);

    happn_client.create({
        config: {username: '_ADMIN', password: 'happn'},
        plugin: happn.client_plugins.intra_process,
        context: happnInstance,
        secure: true,
      },
      function (e, stressTestClient) {
        if (e) return callback(e);

        var count = 0;
        var expected = 1000;
        var receivedCount = 0;
        var timerName = 'CSV.colm 10 ' + expected + 'Events - no wait';

        var writeData = function () {
          if (count == expected) return;

          publisherclient.set('/e2e_test1/testsubscribe/sequence5', {
            property1: count++
          }, {
            excludeId: true
          }, function (e, result) {
            writeData();
          });
        }

        stressTestClient.on('/e2e_test1/testsubscribe/sequence5', {
          event_type: 'set',
          count: 0
        }, function (message) {


          receivedCount++;

          if (receivedCount == expected) {
            console.timeEnd(timerName);
            callback();
          }

        }, function (e) {
          if (!e) {
            console.time(timerName);
            writeData();
          } else
            callback(e);
        });

      });

  });

});
