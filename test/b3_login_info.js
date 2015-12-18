var Happn = require('../');
var expect = require('expect.js');

var service1Name;
var service2Name;

context('login info for application layer', function() {

  context('insecure server', function() {

    beforeEach(function(done) {
      var _this = this;
      Happn.service.create({}).then(function(server) {
        _this.server1 = server;
        service1Name = server.name;
        done();
      }).catch(done);
    });

    afterEach(function(done) {
      if (!this.server1) done();
      this.server1.stop(done);
    });

    it('login info is carried across login', function(done) {
      var events = {};

      this.server1.services.pubsub.on('authentic', function(evt) {
        events['authentic'] = evt;
      });

      this.server1.services.pubsub.on('disconnect', function(evt) {
        events['disconnect'] = evt;
      });

      Happn.client.create({info: {KEY: 'VALUE'}}).then(function(client) {
        // TODO: client.logout()
        client.disconnect();
      }).catch(done);

      setTimeout(function RunAfterClientHasLoggedInAndOut() {

        expect(events).to.eql({
          'authentic': {
            info: {
              happn:{
                name:service1Name
              },
              KEY: 'VALUE',
              _browser: false, // client was not a browser
              _local: false,   // client was not intraprocess
            }
          },
          'disconnect': {
            info: {
              happn:{
                name:service1Name
              },
              KEY: 'VALUE',
              _browser: false,
              _local: false,
            }
          }
        });
        done();

      }, 200);

    });

  });

  context('secure server', function() {

    beforeEach(function(done) {
      var _this = this;
      Happn.service.create({
        secure: true,
        services: {
          security: {
            path:'./services/security/service.js',
            config: {
              adminUser: {
                username: '_ADMIN',
                password: 'secret',
              }
            }
          } 
        }
      }).then(function(server) {
        _this.server2 = server;
        service2Name = server.name;
        done();
      }).catch(done);
    });

    afterEach(function(done) {
      if (!this.server2) done();
      this.server2.stop(done);
    });

    it('login info is carried across login', function(done) {
      var events = {};

      this.server2.services.pubsub.on('authentic', function(evt) {
        events['authentic'] = evt;
      });

      this.server2.services.pubsub.on('disconnect', function(evt) {
        events['disconnect'] = evt;
      });


      Happn.client.create({
        config: {
          username: '_ADMIN',
          password: 'secret',
        },
        info: {KEY: 'VALUE'}
      }).then(function(client) {
        // TODO!: client.logout()
        client.disconnect();
      }).catch(done);

      setTimeout(function RunAfterClientHasLoggedInAndOut() {
        expect(events).to.eql({
          'authentic': {
            info: {
              happn:{
                name:service2Name
              },
              KEY: 'VALUE',
              _browser: false,
              _local: false,
            }
          },
          'disconnect': {
            info: {
              happn:{
                name:service2Name
              },
              KEY: 'VALUE',
              _browser: false,
              _local: false,
            }
          }
        });

        done();

      }, 200); // depending on how long it waits, more and more happn clients
              // from previous tests are attaching to this test's server

    });

  });


});