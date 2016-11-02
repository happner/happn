describe('c8_deferred_listen', function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;

  this.timeout(120000);

  function doRequest(path, token, query, callback, port) {

    var request = require('request');

    if (!port) port = 55000;

    if (path[0] != '/')
      path = '/' + path

    var options = {
      url: 'http://127.0.0.1:' + port.toString() + path
    };

    if (token) {
      if (!query)
        options.headers = {'Cookie': ['happn_token=' + token]}
      else
        options.url += '?happn_token=' + token;
    }

    request(options, function (error, response, body) {
      callback(body);
    });

  }

  var httpServer;
  var connections = {};

  before('it starts up a web server that uses port 55000', function (callback) {

    var http = require('http');

    httpServer = http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('TEST OUTPUT');
    }).listen(55000);

    httpServer.on('connection', function (conn) {
      var key = conn.remoteAddress + ':' + conn.remotePort;
      connections[key] = conn;
      conn.on('close', function () {
        delete connections[key];
      });
    });

    doRequest('/', null, null, function (body) {
      expect(body).to.be('TEST OUTPUT');
      callback();
    });

  });

  var happnInstance;

  it('should initialize the service without listening', function (callback) {

    service.create({
        deferListen: true
      })

      .then(function (happnInst) {
        happnInstance = happnInst;
        callback();
      })

      .catch(callback)

    ;

  });

  var intraProcClientInstance;

  it('should connect to the service with an intra-proc client, perform a set, get and remove', function (callback) {

    happnInstance.services.session.localClient(function (e, instance) {

      if (e) return callback(e);
      intraProcClientInstance = instance;

      intraProcClientInstance.set('/test/', {"test": "data"}, function (e, response) {
        if (e) return callback(e);

        intraProcClientInstance.get('/test/', function (e, response) {
          if (e) return callback(e);

          expect(response.test).to.be('data');

          intraProcClientInstance.remove('/test/', function (e, response) {
            if (e) return callback(e);
            expect(response.removed).to.be(1);
            callback();
          });
        });
      });
    });

  });

  it('should stop the service, even though it hasnt started listening', function (callback) {
    happnInstance.stop(callback);
  });

  it('should initialize the service without listening again', function (callback) {
    service.create({
        deferListen: true
      })

      .then(function (happnInst) {
        happnInstance = happnInst;
        callback();
      })

      .catch(callback)

    ;
  });

  it('should try and start the service, but fail with EADDRINUSE, then kill the http server, then successfully retry', function (callback) {
    happnInstance.listen(function (e) {

      //cannot listen
      expect(e.toString()).to.be("Error: timeout");

      for (var key in connections) {
        connections[key].destroy();
      }

      httpServer.close();

      setTimeout(function () {
        happnInstance.listen(function (e) {
          expect(e).to.be(null);

          doRequest('version', null, null, function (body) {
            expect(body.version).to.not.be(null)
            callback();
          });

        });

      }, 2000);

    })
  });

  after(function (done) {

    //require('benchmarket').stop();

    if (happnInstance)
      happnInstance.stop(done);
    else done();
  });

});
