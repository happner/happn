describe('e9_client_disconnect', function () {

  var happn = require('../lib/index');
  var serviceInstance;
  var expect = require('expect.js');

  var getService = function (config, callback) {
    happn.service.create(config,
      callback
    );
  };

  var http = require('http');

  function doRequest(path, token, query, callback, excludeToken) {

    var request = require('request');

    var options = {
      url: 'http://127.0.0.1:55000' + path,
    };

    if (!excludeToken){
      if (!query)
        options.headers = {'Cookie': ['happn_token=' + token]}
      else
        options.url += '?happn_token=' + token;
    }

    request(options, function (error, response, body) {
      callback(response, body);
    });

  }

  before('it starts completely defaulted service', function (done) {

    getService({
      secure: true,
      services:{
        security:{
          config:{
            profiles:[
              {
                name:"test-session",
                session:{
                  $and:[{
                    user:{username:{$eq:'TEST_SESSION'}}
                  }]
                },
                policy:{
                  ttl: '2 seconds',
                  inactivity_threshold:'2 seconds'
                }
              }
            ]
          }
        }
      }
    }, function (e, service) {

      if (e) return done(e);

      serviceInstance = service;

      serviceInstance.connect.use('/TEST/WEB/ROUTE', function (req, res, next) {

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({"secure": "value"}));
      });

      done();
    });
  });

  after('stop the test service', function (callback) {
    serviceInstance.stop(callback);
  });

  var testGroup = {
    name: 'TEST GROUP',
    permissions:{
      '/TEST/DATA/*':{actions: ['*']},
      '/@HTTP/TEST/WEB/ROUTE':{actions: ['get']}
    }
  };

  var testUser = {
    username: 'TEST_SESSION',
    password: 'TEST PWD'
  };

  var addedTestGroup;
  var addedTestuser;

  var testClient;

  before('creates a group and a user, adds the group to the user, logs in with test user', function (done) {

    serviceInstance.services.security.upsertGroup(testGroup, {overwrite: false}, function (e, result) {

      if (e) return done(e);
      addedTestGroup = result;

      serviceInstance.services.security.upsertUser(testUser, {overwrite: false}, function (e, result) {

        if (e) return done(e);
        addedTestuser = result;

        serviceInstance.services.security.linkGroup(addedTestGroup, addedTestuser, done);
      });
    });
  });

  it('logs in with the eventemitter user - we then test a call to a web-method, then disconnects with the revokeToken flag set to true, we try and reuse the token and ensure that it fails', function (done) {

    happn.client.create({
        config: {username: testUser.username, password: 'TEST PWD'},
        secure: true
      })

      .then(function (clientInstance) {

        testClient = clientInstance;

        var sessionToken = testClient.session.token;

        doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

          expect(response.statusCode).to.equal(200);

          testClient.disconnect({revokeSession:true}, function(e){

            if (e) return done(e);

            doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

              expect(response.statusCode).to.equal(403);

              console.log(response.body);

              done();
            });
          });
        });
      })

      .catch(function (e) {
        done(e);
      });

  });

  it('logs in with the eventemitter user - we then test a call to a web-method, then disconnects with the revokeToken flag set to false, we try and reuse the token and ensure that it succeeds', function (done) {

    happn.client.create({
        config: {username: testUser.username, password: 'TEST PWD'},
        secure: true
      })

      .then(function (clientInstance) {

        testClient = clientInstance;

        var sessionToken = testClient.session.token;

        doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

          expect(response.statusCode).to.equal(200);

          testClient.disconnect({revokeSession:false}, function(e){

            if (e) return done(e);

            doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

              expect(response.statusCode).to.equal(200);

              done();
            });
          });
        });
      })

      .catch(function (e) {
        done(e);
      });
  });

  it('logs in with the eventemitter user - we then test a call to a web-method, then disconnects with the revokeToken flag set to true, we try and reuse the token and ensure that it fails, then wait longer and ensure even after the token is revoked it still fails', function (done) {

    this.timeout(10000);

    happn.client.create({
        config: {username: testUser.username, password: 'TEST PWD'},
        secure: true
      })

      .then(function (clientInstance) {

        testClient = clientInstance;

        var sessionToken = testClient.session.token;
        var sessionId = testClient.session.id;

        doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

          expect(response.statusCode).to.equal(200);

          testClient.disconnect({revokeSession:true}, function(e){

            if (e) return done(e);

            var cachedToken = serviceInstance.services.security.__cache_revoked_sessions.get(sessionId);

            expect(cachedToken.reason).to.equal('CLIENT');

            doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

              expect(response.statusCode).to.equal(403);

              setTimeout(function(){

                doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

                  expect(response.statusCode).to.equal(403);

                  cachedToken = serviceInstance.services.security.__cache_revoked_sessions.get(sessionId);

                  expect(cachedToken).to.equal(null);

                  done();
                });

              }, 4010);
            });
          });
        });
      })

      .catch(function (e) {
        done(e);
      });
  });
});
