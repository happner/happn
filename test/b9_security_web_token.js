describe('b9_security_web_token', function () {

  //require('benchmarket').start();
  //after(//require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var happnInstance = null;
  var test_id = Date.now() + '_' + require('shortid').generate();

  var http = require('http');

  var adminClient;
  var testClient;

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

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  var Crypto = require('happn-util-crypto');
  var crypto = new Crypto();

  var keyPair = crypto.createKeyPair();

  before('should initialize the service', function (callback) {

    this.timeout(20000);

    try {
      service.create({
        secure: true,
        middleware: {
          security: {
            exclusions: [
              '/test/excluded/specific',
              '/test/excluded/wildcard/*',
            ]
          }
        },
        services:{
          security:{
            config:{
              adminUser:{
                publicKey:keyPair.publicKey
              }
            }
          }
        }
      }, function (e, happnInst) {
        if (e)
          return callback(e);

        happnInstance = happnInst;

        happnInstance.connect.use('/secure/route/test', function (req, res, next) {

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({"secure": "value"}));

        });

        happnInstance.connect.use('/secure/route', function (req, res, next) {

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({"secure": "value"}));

        });

        happnInstance.connect.use('/secure/route/qs', function (req, res, next) {

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({"secure": "value"}));

        });

        happnInstance.connect.use('/test/excluded/wildcard/blah', function (req, res, next) {

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({"secure": "value"}));

        });

        happnInstance.connect.use('/test/excluded/specific', function (req, res, next) {

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({"secure": "value"}));

        });

        happnInstance.connect.use('/secure/test/removed/group', function (req, res, next) {

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({"secure": "value"}));

        });

        happnInstance.connect.use('/secure/test/removed/user', function (req, res, next) {

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({"secure": "value"}));

        });

        callback();

      });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {

    adminClient.disconnect()
      .then(testClient.disconnect()
        .then(happnInstance.stop()
          .then(done)))
      .catch(done);


  });

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  before('should initialize the admin client', function (callback) {

    happn.client.create({
        config: {username: '_ADMIN', password: 'happn'},
        secure: true
      })

      .then(function (clientInstance) {
        adminClient = clientInstance;
        callback();
      })

      .catch(function (e) {
        callback(e);
      });

  });

  var testGroup = {
    name: 'TEST GROUP' + test_id,
    custom_data: {
      customString: 'custom1',
      customNumber: 0
    }
  }

  var testUser = {
    username: 'TEST USER@blah.com' + test_id,
    password: 'TEST PWD',
    custom_data: {
      something: 'usefull'
    }
  }

  var addedTestGroup;
  var addedTestuser;


  before('creates a group and a user, adds the group to the user, logs in with test user', function (done) {

    happnInstance.services.security.upsertGroup(testGroup, {overwrite: false}, function (e, result) {

      if (e) return done(e);
      addedTestGroup = result;

      happnInstance.services.security.upsertUser(testUser, {overwrite: false}, function (e, result) {

        if (e) return done(e);
        addedTestuser = result;

        happnInstance.services.security.linkGroup(addedTestGroup, addedTestuser, function (e) {

          if (e) return done(e);

          happn.client.create({
              config: {username: testUser.username, password: 'TEST PWD'},
              secure: true
            })

            .then(function (clientInstance) {
              testClient = clientInstance;
              done();
            })

            .catch(function (e) {
              done(e);
            });

        });
      });
    });
  });

  it('the server should set up a secure route, the admin client should connect ok', function (callback) {

    try {

      doRequest('/secure/route', adminClient.session.token, false, function (response) {

        expect(response.statusCode).to.equal(200);
        callback();

      });

    } catch (e) {
      callback(e);
    }
  });

  it('the server should set up a secure route, the admin client should connect ok passing the token on the querystring', function (callback) {

    try {

      doRequest('/secure/route/qs', adminClient.session.token, true, function (response) {

        expect(response.statusCode).to.equal(200);
        callback();

      });

    } catch (e) {
      callback(e);
    }
  });

  it('the server should set up another secure route, the test client should fail to connect', function (callback) {

    try {

      doRequest('/secure/route/test', testClient.session.token, false, function (response) {

        expect(response.statusCode).to.equal(403);
        callback();

      });

    } catch (e) {
      callback(e);
    }
  });

  it('updates the group associated with the test user to allow gets to the path, the user should succeed in connecting to the url', function (callback) {

    try {

      testGroup.permissions = {'/@HTTP/secure/route/test': {actions: ['get']}};

      happnInstance.services.security.upsertGroup(testGroup, {}, function (e, group) {
        if (e) return done(e);
        expect(group.permissions['/@HTTP/secure/route/test']).to.eql({actions: ['get']});

        doRequest('/secure/route/test', testClient.session.token, false, function (response) {

          expect(response.statusCode).to.equal(200);
          callback();

        });
      });

    } catch (e) {
      callback(e);
    }
  });

  it('updates the group associated with the test user to allow gets to the path, the user should succeed in connecting to the url with the query string', function (callback) {

    try {

      testGroup.permissions = {'/@HTTP/secure/route/test': {actions: ['get']}};

      happnInstance.services.security.upsertGroup(testGroup, {}, function (e, group) {
        if (e) return done(e);
        expect(group.permissions['/@HTTP/secure/route/test']).to.eql({actions: ['get']});

        doRequest('/secure/route/test', testClient.session.token, true, function (response) {

          expect(response.statusCode).to.equal(200);
          callback();

        });
      });

    } catch (e) {
      callback(e);
    }
  });

  it('tests the excluded wildcard route to ensure anyone can access it', function (callback) {

    doRequest('/test/excluded/wildcard/blah', null, false, function (response) {
      expect(response.statusCode).to.equal(200);
      callback();
    });

  });

  it('tests the excluded specific route to ensure anyone can access it', function (callback) {

    this.timeout(20000);

    doRequest('/test/excluded/specific', null, true, function (response) {
      expect(response.statusCode).to.equal(200);
      callback();
    });

  });

  it('tests doing a request for a token using a GET with a username and password', function (callback) {

    doRequest('/auth/login?username=_ADMIN&password=happn', null, true, function (response, body) {
      expect(response.statusCode).to.equal(200);

      var token = JSON.parse(body).data;

      doRequest('/secure/route/qs', token, true, function (response) {

        expect(response.statusCode).to.equal(200);
        callback();

      });

    }, true);

  });

  it('tests doing a request for a nonce using a GET with a username and password, nonce is encrypted for a login', function (callback) {

    var encodedPublicKey = encodeURIComponent(keyPair.publicKey)

    doRequest('/auth/request-nonce?publicKey=' + encodedPublicKey + '&user=_ADMIN', null, true, function (response, body) {

      expect(response.statusCode).to.equal(200);

      var nonce = JSON.parse(body).data;

      var digest = crypto.sign(nonce, keyPair.privateKey);

      var encodedDigest = encodeURIComponent(digest);

      doRequest('/auth/login?username=_ADMIN&digest=' + encodedDigest + '&publicKey=' + encodedPublicKey, null, true, function (response, body) {

        expect(response.statusCode).to.equal(200);
        callback();

      }, true);

    }, true);

  });

  it('removes the permission from the test group - we ensure we can not access the resource with the token', function (callback) {

    var testGroup1 = {
      name: 'TEST GROUP1' + test_id,
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    testGroup1.permissions = {
      '/@HTTP/secure/test/removed/group': {actions: ['get']},
      '/@HTTP/secure/test/not_removed/group': {actions: ['get']}
    };

    var testUser1 = {
      username: 'TEST USER1@blah.com' + test_id,
      password: 'TEST PWD',
      custom_data: {
        something: 'usefull'
      }
    };

    var addedTestGroup1;
    var addedTestuser1;

    happnInstance.services.security.upsertGroup(testGroup1, {overwrite: false}, function (e, result) {

      if (e) return done(e);
      addedTestGroup1 = result;

      happnInstance.services.security.upsertUser(testUser1, {overwrite: false}, function (e, result) {

        if (e) return done(e);
        addedTestuser1 = result;

        happnInstance.services.security.linkGroup(addedTestGroup1, addedTestuser1, function (e) {

          if (e) return done(e);

          happn.client.create({
              config: {username: testUser1.username, password: 'TEST PWD'},
              secure: true
            })

            .then(function (clientInstance) {

              testClient = clientInstance;

              doRequest('/secure/test/removed/group', testClient.session.token, false, function (response) {

                expect(response.statusCode).to.equal(200);

                delete addedTestGroup1.permissions['/@HTTP/secure/test/removed/group'];

                happnInstance.services.security.upsertGroup(addedTestGroup1, {overwrite: true}, function (e) {

                  if (e) return done(e);

                  doRequest('/secure/test/removed/group', testClient.session.token, false, function (response) {

                    expect(response.statusCode).to.equal(403);
                    callback();

                  });
                });
              });
            })

            .catch(function (e) {
              done(e);
            });

        });
      });
    });
  });

  it('removes the user associated with the token - we ensure we can not access the resource with the token', function (callback) {

    var testGroup2 = {
      name: 'TEST GROUP2' + test_id,
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
      username: 'TEST USER2@blah.com' + test_id,
      password: 'TEST PWD',
      custom_data: {
        something: 'usefull'
      }
    };

    var addedTestGroup2;
    var addedTestuser2;

    happnInstance.services.security.upsertGroup(testGroup2, {overwrite: false}, function (e, result) {

      if (e) return done(e);
      addedTestGroup2 = result;

      happnInstance.services.security.upsertUser(testUser2, {overwrite: false}, function (e, result) {

        if (e) return done(e);
        addedTestuser2 = result;

        happnInstance.services.security.linkGroup(addedTestGroup2, addedTestuser2, function (e) {

          if (e) return done(e);

          happn.client.create({
              config: {username: testUser2.username, password: 'TEST PWD'},
              secure: true
            })

            .then(function (clientInstance) {

              testClient = clientInstance;

              doRequest('/secure/test/removed/user', testClient.session.token, false, function (response) {

                expect(response.statusCode).to.equal(200);

                happnInstance.services.security.deleteUser(addedTestuser2, function (e) {

                  if (e) return done(e);

                  doRequest('/secure/test/removed/user', testClient.session.token, false, function (response) {

                    expect(response.statusCode).to.equal(403);
                    callback();

                  });
                });
              });
            })

            .catch(function (e) {
              done(e);
            });

        });
      });
    });
  });

  //require('benchmarket').stop();

});
