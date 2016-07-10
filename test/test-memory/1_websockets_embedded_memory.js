if (!global.gc) {
  console.log('Not testing memory leaks, run with argument --expose-gc')
  process.kill();
}

describe('1-websockets-embedded-memory', function () {

  require('benchmarket').start();
  after(require('benchmarket').store());

  var spawn = require('child_process').spawn;
  var should = require('chai').should();
  var happn = require('../../lib/index');
  var happn_client = happn.client;

  var test_secret = 'test_secret';
  var default_timeout = 50000;
  var test_id;

  var sep = require('path').sep;
  var libFolder = __dirname + sep + 'lib' + sep;
  var remote;

  var publisherclient;

  before(function (callback) {

    this.timeout(20000);

    test_id = Date.now() + '_' + require('shortid').generate();

    remote = spawn('node', [libFolder + '1-remoteService']);

    remote.stdout.on('data', function (data) {

      //console.log(data.toString());

      if (data.toString().match(/happn version/)) {
        happn_client.create({config: {port: 8001}}, function (e, instance) {

          if (e) return callback(e);

          publisherclient = instance;

          callback();
        });
      }
    });
  });

  after(function (done) {
    this.timeout(10000);
    publisherclient.disconnect(function () {
      remote.kill();
      done();
    })

  });

  // set this to a value to leave enough time before and after the test to take a snapshot
  var snapshotTimer = 0;

  it('should not leak memory when doing remote calls', function (callback) {

    this.timeout(default_timeout);
    var timesCount = 15;
    var memUsage = [];

    //do a 1000 sets to fill cache
    var empty = {};
    for (var i = 0; i < 1000; i++) {
      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/set_multiple/empty' + i, empty, {});
    }
    global.gc();

    var count = 0;
    if (snapshotTimer) console.log('SNAPSHOT');
    setTimeout(doTest, snapshotTimer);

    function doTest() {

      // take memory usage snapshot after each operation
      global.gc();
      memUsage[count] = process.memoryUsage().heapUsed;

      // create a large object that should be freed by the next time this function runs.
      var object = {};
      for (var i = 0; i < 10000; i++) {
        object[i] = Math.random();
      }

      // do a set that should not hold up this closure
      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/set_multiple/test' + count, object, {}, function (err) {
        // need to reference this in the callback as happner might do
        object[0].should.exist;
        should.not.exist(err);
        if (++count == timesCount) {
          if (snapshotTimer)console.log('SNAPSHOT');
          return setTimeout(testComplete, snapshotTimer);
        }
        setImmediate(doTest);
      });
    }

    function testComplete(e) {

      if (e) return callback(e);

      //console.log(memUsage);
      // If the memory is not freed, the usage goes up by ~230000
      (memUsage[timesCount - 1] - memUsage[timesCount - 2]).should.be.lt(50000);
      callback();

    }
  });

  require('benchmarket').stop();

});
