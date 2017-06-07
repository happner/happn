// network-simulator uses [socket].cork() to mimic large payload - not implemented in node v0.10

if (!process.version.match(/^v0\.10/)) {

  var filename = require('path').basename(__filename);
  var expect = require('expect.js');
  var NetworkSimulator = require('./lib/network-simulator');
  var happn = require('..');
  var HappnServer = happn.service;
  var HappnClient = happn.client;

  describe(filename, function () {

    this.timeout(40000);

    var log = true; // show tested events

    var happnPort = 55000;
    var relayPort = 8080;

    var events;
    var data;
    var dataCount;

    before('start network relay', function (done) {

      this.network = new NetworkSimulator({

        log: false, // show network traffic

        forwardToPort: happnPort,
        listenPort: relayPort,
        latency: 250 // actual network latency, not faux large payload transmission-time, see .startLargePayload()
      });

      this.network.start().then(done).catch(done);

    });

    before('start happn server', function (done) {

      var _this = this;

      function heartBeatSkippedHandler(data) {
        if (log) console.log('SKIPPED', data);
        events.push('SKIPPED ' + data);
      }

      function flatLineHandler(data) {
        if (log) console.log('FLATLINED', data);
        events.push('FLATLINED ' + data);
      }

      HappnServer.create({})

        .then(function (server) {
          _this.server = server;
          done();
        })

        .catch(done);

    });

    before('start control client', function (done) {

      var _this = this;

      HappnClient.create()

        .then(function (client) {

          _this.controlClient = client;

          client.interval = setInterval(function () {
            client.set('/some/data', {
              count: dataCount++
            });
          }, 1000);

          done();
        })

        .catch(done);

    })

    after('stop control client', function (done) {

      if (!this.controlClient) return done();
      clearInterval(this.controlClient.interval);
      this.controlClient.disconnect(done);

    });

    after('stop happn server', function (done) {

      if (!this.server) return done();
      this.server.stop({
        reconnect: false
      }, done);

    });

    after('stop network relay', function (done) {

      this.network.stop().then(done).catch(done);

    });

    context('with large payload', function () {

      // Ensure the socket stays alive despite the heartbeat skip at
      // the server and that when the heartbeat skip is exceeded the
      // socket is closed.

      before('start happn client 1', function (done) {

        var _this = this;

        events = [];
        data = [];

        HappnClient.create({
            config: {
              port: relayPort,
              pubsub: {
                options: {
                  ping: 2000,
                  pong: 1000
                }
              }
            }
          })

          .then(function (client) {
            _this.testClient1 = client;

            client.pubsub.on('outgoing::ping', function () {
              if (log) console.log('SENT PING');
              events.push('SENT PING');
            });

            client.pubsub.on('incoming::pong', function () {
              if (log) console.log('RECEIVED PONG');
              events.push('RECEIVED PONG');
            });

            client.on('/some/data',
              function (_data) {
                if (log) console.log('RECEIVED DATA', _data.count);
                data.push('RECEIVED DATA ' + _data.count);
              },
              function (e) {
                if (e) return done(e);
                done();
              });

          })

          .catch(done);

      });

      it('client receives expected event pattern', function (done) {

        var _this = this;

        dataCount = 1;
        data = [];

        this.network.startLargePayload(); // <-------------

        this.testClient1.onEvent('reconnect-successful', function () {

          if (log) console.log('RECONNECTED');
          events.push('RECONNECTED');

          _this.testClient1.disconnect();

          _this.network.stopLargePayload();

          expect(events).to.eql([
            'SENT PING',
            'RECEIVED PONG',
            'SENT PING',
            'RECEIVED PONG',
            'SENT PING',
            'RECONNECTED'
          ]);

          expect(data).to.eql([
            'RECEIVED DATA null',
            'RECEIVED DATA 1',
            'RECEIVED DATA 2',
            'RECEIVED DATA 3',
            'RECEIVED DATA 4',
            'RECEIVED DATA 5'
          ])

          done();

        });

      });

    });

    context('with short network segmentation', function () {

      // Ensure there's no catastrophy when on an actual network outage
      // occurs that does not exceed allowed heartbeat skips at server.
      //
      // 1. client receives no pong from server
      // 2. client closes socket
      // 3. socket FIN does not reach server
      // 4. server thinks it still has a socket
      // 5. network resumes before server closes the socket (allowed
      //    skipped heartbeats not exceeded)
      // 6. server starts attempting to use the original socket
      // 7. client creates a new socket
      //

      before('start happn client 1', function (done) {

        var _this = this;

        events = [];
        data = [];

        debugger;

        HappnClient.create({
            config: {
              port: relayPort,
              pubsub: {
                options: {
                  ping: 2000,
                  pong: 1000
                }
              }
            }
          })

          .then(function (client) {
            _this.testClient2 = client;

            client.pubsub.on('outgoing::ping', function () {
              if (log) console.log('SENT PING');
              events.push('SENT PING');
            });

            client.pubsub.on('incoming::pong', function () {
              if (log) console.log('RECEIVED PONG');
              events.push('RECEIVED PONG');
            });

            client.on('/some/data',
              function (_data) {
                if (log) console.log('RECEIVED DATA', _data.count);
                data.push('RECEIVED DATA ' + _data.count);
              },
              function (e) {
                if (e) return done(e);
                done();
              });

          })

          .catch(done);

      });

      it('client receives expected data pattern', function (done) {

        var _this = this;

        this.network.startNetworkSegmentation(); // <-------------

        this.testClient2.onEvent('reconnect-scheduled', function () {

          if (log) console.log('RECONNECT SCHEDULED');
          events.push('RECONNECT SCHEDULED');

          setTimeout(function () {
            _this.network.stopNetworkSegmentation();
          }, 200);

        });

        this.testClient2.onEvent('reconnect-successful', function () {

          if (log) console.log('RECONNECTED');
          events.push('RECONNECTED');

          data = [];
          dataCount = 1;

          var interval = setInterval(function () {

            if (data.length < 5) return;

            clearInterval(interval);

            // data.shift(); // late arriving data

            // No error/crash at server because of sending
            // to unconnected socket.

            // Data is not doubling up.
            expect(data).to.eql([
              'RECEIVED DATA 1',
              'RECEIVED DATA 2',
              'RECEIVED DATA 3',
              'RECEIVED DATA 4',
              'RECEIVED DATA 5'
            ]);

            done();

          }, 50);

        });

      });

    });

    context('with long network segmentstion', function () {

      // There are no concerns on long network segmentation that exceeds
      // the allowed skip at the server because both sides will have
      // closed the socket.

    });

  });

}
