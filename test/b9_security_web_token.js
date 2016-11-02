describe('b9_security_web_token', function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
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
        services:{
          connect:{
            config:{
              middleware:{
                security: {
                  exclusions: [
                    '/test/excluded/specific',
                    '/test/excluded/wildcard/*',
                  ]
                }
              }
            }
          },
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

        callback();

      });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {

    this.timeout(15000);

    adminClient.disconnect(function(e){
      if (e) return done(e);
      testClient.disconnect(function(e){
        if (e) return done(e);
        happnInstance.stop(done);
      });
    });
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

    happnInstance.services.security.users.upsertGroup(testGroup, {overwrite: false}, function (e, result) {

      if (e) return done(e);
      addedTestGroup = result;

      happnInstance.services.security.users.upsertUser(testUser, {overwrite: false}, function (e, result) {

        if (e) return done(e);
        addedTestuser = result;

        happnInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser, function (e) {

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

      happnInstance.services.security.users.upsertGroup(testGroup, {}, function (e, group) {
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

      happnInstance.services.security.users.upsertGroup(testGroup, {}, function (e, group) {
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

  xit('removes the permission from the test group - we ensure we can not access the resource with the token', function (callback) {


  });

  xit('access a resource using the token as part of the url as a querystring argument', function (callback) {


  });

  //require('benchmarket').stop();

});
