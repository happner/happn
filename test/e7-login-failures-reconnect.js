var Happn = require('../');
var expect = require('expect.js');
var Promise = require('bluebird');

var service1Name;
//checks info is stored next to login
describe(require('path').basename(__filename), function () {

  this.timeout(60000);

  var server1;

  var testGroup2 = {
    name: 'TEST GROUP2',
    custom_data: {
      customString: 'custom2',
      customNumber: 0
    }
  };

  testGroup2.permissions = {
    '/@HTTP/secure/test/removed/user': {actions: ['get']},
    '/@HTTP/secure/test/not_removed/user': {actions: ['get']}
  };

  var testUser2 = {
    username: 'TEST USER2@blah.com',
    password: 'TEST PWD'
  };

  function linkUser() {
    return new Promise(function (resolve, reject) {
      var addedTestGroup2;
      var addedTestuser2;

      server1.services.security.upsertGroup(testGroup2, {overwrite: false}, function (e, result) {

        if (e) return reject(e);
        addedTestGroup2 = result;

        server1.services.security.upsertUser(testUser2, {overwrite: false}, function (e, result) {

          if (e) return reject(e);
          addedTestuser2 = result;

          server1.services.security.linkGroup(addedTestGroup2, addedTestuser2, function (e) {

            if (e) return reject(e);
            resolve();
          });
        });
      });
    });
  }

  function createService(allowLogin) {
    return Happn.service.create({secure: true})
      .then(function (server) {
        server1 = server;
        service1Name = server.name;
        if (!allowLogin) {
          server1.services.pubsub.login = function () {
            this.emit('loginAttempt');
          };
        }
        server1.services.pubsub.primus.on('connection', function () {
          console.log('Connection attempt');
          server1.services.pubsub.emit('connectionAttempt');
        });
      })
      .then(linkUser);
  }

  function stopService() {
    return new Promise(function (resolve) {
      if (!server1) resolve();
      server1.stop(function (e) {
        if (e) {
          console.warn('failed to stop server1: ' + e.toString());
          reject(e);
          return;
        }
        resolve();
      });
    });
  }

  before('starts the services', function () {
    return createService(true);
  });

  after('stops the services', function () {
    return stopService();
  });

  it('logs in normally', function () {
    Happn.client.create(
      {
        config: {
          username: testUser2.username,
          password: testUser2.password
        }
      })
      .then(function (clientInstance) {
        return clientInstance.disconnect();
      })
  });

  it('can login again if a login attempt failed on reconnect', function () {
    var client;

    return Happn.client.create(
      {
        config: {
          username: testUser2.username,
          password: testUser2.password
        }
      })
      .then(function (clientInstance) {
        client = clientInstance;
        return stopService();
      })
      .then(function waitForDisconnect() {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-scheduled',
              function waitForReconnectScheduled() {
                client.offEvent(subHandle);
                resolve();
              });
          }
        });
      })
      .then(function startServiceWithNoLogin() {
        return createService(false);
      })
      .then(function waitForLoginAttempt() {
        return new Promise(function (resolve) {
          server1.services.pubsub.on('loginAttempt', function waitForAttempt() {
            server1.services.pubsub.removeAllListeners('loginAttempt');
            resolve();
          })
        });
      })
      .then(function () {
        delete server1.services.pubsub.login;
      })
      .then(function () {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-successful',
              function waitForConnectSuccess() {
                client.offEvent(subHandle);
                resolve();
              });
          }
        });
      })
      .then(function () {
        return client.disconnect();
      })
  });

  it('emits when it retries to reconnect', function () {
    var client;

    return Happn.client.create(
      {
        config: {
          username: testUser2.username,
          password: testUser2.password
        }
      })
      .then(function (clientInstance) {
        client = clientInstance;
        return stopService();
      })
      .then(function waitForDisconnect() {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-scheduled',
              function waitForReconnectScheduled() {
                client.offEvent(subHandle);
                resolve();
              });
          }
        });
      })
      .then(function startServiceWithNoLogin() {
        return createService(false);
      })
      .then(function waitForLoginAttempt() {
        return new Promise(function (resolve) {
          server1.services.pubsub.on('loginAttempt', function waitForAttempt() {
            server1.services.pubsub.removeAllListeners('loginAttempt');
            resolve();
          })
        });
      })
      .then(stopService)
      .then(function () {
        return createService(true);
      })
      .then(function () {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect',
              function waitForConnectSuccess() {
                resolve();
              });
          }
        });
      })
      .then(function () {
        return client.disconnect();
      });
  });

  it('does not retry if we are connected', function () {
    var client;

    return Happn.client.create(
      {
        config: {
          username: testUser2.username,
          password: testUser2.password
        }
      })
      .then(function (clientInstance) {
        client = clientInstance;
        return stopService();
      })
      .then(function waitForDisconnect() {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-scheduled',
              function waitForReconnectScheduled() {
                client.offEvent(subHandle);
                resolve();
              });
          }
        });
      })
      .then(function startServiceWithNoLogin() {
        return createService(false);
      })
      .then(function waitForLoginAttempt() {
        return new Promise(function (resolve) {
          server1.services.pubsub.on('loginAttempt', function waitForAttempt() {
            server1.services.pubsub.removeAllListeners('loginAttempt');
            resolve();
          })
        });
      })
      .then(stopService)
      .then(function () {
        return createService(true);
      })
      .then(function () {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-successful',
              function waitForConnectSuccess() {
                client.offEvent(subHandle);
                resolve();
              });
          }
        });
      })
      .then(function () {
        return new Promise(function (resolve, reject) {
          {
            var subHandle = client.onEvent('reconnect',
              function waitForConnectSuccess() {
                reject(new Error('This should not happen'));
              });
            setTimeout(function () {
              client.offEvent(subHandle);
              resolve();
            }, 20000);
          }
        });
      })
      .then(function () {
        return client.disconnect();
      });
  });

  it('will not reconnect after shutdown', function () {
    var client;

    return Happn.client.create(
      {
        config: {
          username: testUser2.username,
          password: testUser2.password
        }
      })
      .then(function (clientInstance) {
        client = clientInstance;
        return stopService();
      })
      .then(function () {
        return client.disconnect();
      })
      .then(function startServiceWithNoLogin() {
        return createService(false);
      })
      .then(function () {
        return new Promise(function (resolve) {
          {
            var eventCalled = 0;
            var subHandle = client.onEvent('reconnect',
              function waitForReconnect() {
                eventCalled++;
              });

            setTimeout(function () {
              expect(eventCalled).to.equal(0);
              client.offEvent(subHandle);
              resolve();
            }, 20000)
          }
        });
      })
      .then(function () {
        return client.disconnect();
      })
  });

  it('kills a client that is started with create and fails to login', function (done) {
    Happn.client.create(
      {
        config: {
          username: testUser2.username,
          password: 'bad_password'
        }
      })
      .then(function () {
        return done(new Error('Should not get a client'));
      })
      .catch(function (e) {
        expect(e).to.not.be.empty();
        stopService()
          .then(function () {
            return createService(true);
          })
          .then(function () {
            server1.services.pubsub.on('connectionAttempt', function waitForAttempt() {
              done(new Error("Should not get a connection attempt"));
            });
            setTimeout(function () {
              server1.services.pubsub.removeAllListeners('connectionAttempt');
              done();
            }, 10000);
          });
      });

  });
});
