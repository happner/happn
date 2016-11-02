var Happn = require('../');
var expect = require('expect.js');

var service1Name;
var service2Name;
//checks info is stored next to login
context('b3_login_info', function () {

  this.timeout(60000);

  // require('benchmarket').start();
  // after(require('benchmarket').store());

  this.timeout(60000);

  var server1;
  var server2;

  before('starts the services', function (done) {
    Happn.service.create({port: 55005}).then(function (server) {
      server1 = server;
      service1Name = server.name;
      Happn.service.create({
        port: 55006,
        secure: true,
        services: {
          security: {
            config: {
              adminUser: {
                username: '_ADMIN',
                password: 'secret',
              }
            }
          }
        }
      }).then(function (server) {
        server2 = server;
        service2Name = server.name;
        done();
      }).catch(done);
    }).catch(done);
  });

  after('stops the services', function (done) {
    if (!server1) done();
    server1.stop(function (e) {
      if (e) console.warn('failed to stop server1: ' + e.toString());

      if (!server2) done();
      server2.stop(function (e) {
        if (e) console.warn('failed to stop server2: ' + e.toString());
        done();
      });

    });
  });

  context('insecure server', function () {

    var sessionId;

    it('login info is carried across login', function (done) {

      var events = {};

      server1.services.session.on('connect', function (evt) {
        sessionId = evt.id;
        events['connect'] = evt;
      });

      server1.services.session.on('authentic', function (evt) {
        events['authentic'] = evt;
      });

      server1.services.session.on('disconnect', function (evt) {
        events['disconnect'] = evt;
      });

      Happn.client.create({info: {KEY: 'VALUE'}, config: {port: 55005}}).then(function (client) {
        client.disconnect();
      }).catch(done);

      setTimeout(function RunAfterClientHasLoggedInAndOut() {

        expect(events.connect.happn.name).to.equal(service1Name);
        expect(events.disconnect.happn.name).to.equal(service1Name);
        //
        expect(events.disconnect.info.KEY).to.equal("VALUE");
        expect(events.authentic.info.KEY).to.equal("VALUE");
        expect(events.disconnect.info._local).to.equal(false);
        //
        expect(events.connect.id).to.equal(sessionId);
        expect(events.disconnect.id).to.equal(sessionId);
        //
        done();

      }, 1000);

    });

  });

  context('secure server', function () {

    var sessionId;

    it('login info is carried across login', function (done) {
      var events = {};

      server2.services.session.on('authentic', function (evt) {
        sessionId = evt.id;
        events['authentic'] = evt;
      });

      server2.services.session.on('connect', function (evt) {
        events['connect'] = evt;
      });

      server2.services.session.on('disconnect', function (evt) {
        events['disconnect'] = evt;
      });

      Happn.client.create({
        config: {
          username: '_ADMIN',
          password: 'secret',
          port: 55006
        },
        info: {"KEY": "VALUE"}
      }).then(function (client) {
        client.disconnect();
      }).catch(done);

      setTimeout(function RunAfterClientHasLoggedInAndOut() {

        expect(events.connect.happn.name).to.equal(service2Name);
        expect(events.disconnect.happn.name).to.equal(service2Name);

        expect(events.connect.happn.name).to.equal(service2Name);
        expect(events.authentic.info.KEY).to.equal("VALUE");
        expect(events.disconnect.info.KEY).to.equal("VALUE");

        expect(events.connect.happn.name).to.equal(service2Name);
        expect(events.authentic.info._browser).to.equal(false);
        expect(events.disconnect.info._local).to.equal(false);

        expect(events.connect.happn.name).to.equal(service2Name);
        expect(events.authentic.id).to.equal(sessionId);
        expect(events.disconnect.id).to.equal(sessionId);

        done();

      }, 200); // depending on how long it waits, more and more happn clients
      // from previous tests are attaching to this test's server

    });

  });

  //require('benchmarket').stop();

});
