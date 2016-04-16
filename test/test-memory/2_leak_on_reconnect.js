if (!global.gc) {
  console.log('Not testing memory leaks, run with argument --expose-gc')
  process.kill();
}

var async = require('async');
var filename = require('path').basename(__filename);

describe(filename, function () {

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
      done();
    })

  });

  // set this to a value to leave enough time before and after the test to take a snapshot
  var snapshotTimer = 0;

  it('should not leak memory reconnecting', function (callback) {

    var count = 20;

    async.series([
      function (cb) {
        async.times(count, function (n, timesCB) {
            writeBigBuffer(timesCB);
          },
          cb
        );
      },
      function (cb) {

      }]);

    function writeBigBuffer(cb) {
      var buffer = new Buffer(102400);
      var object = {buffer: buffer};
      publisherclient.set('/2_leak/buffer', object, {}, cb);
    }

  });

  require('benchmarket').stop();

});