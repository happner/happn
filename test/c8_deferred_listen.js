

describe('c8_deferred_listen', function () {

    require('benchmarket').start();
    after(require('benchmarket').store());

    var expect = require('expect.js');
    var happn = require('../lib/index')
    var service = happn.service;
    var happn_client = happn.client;
    var happnInstance = null;
    var test_id;

    function doRequest(path, token, query, callback){

        var request = require('request');

        var options = {
            url: 'http://127.0.0.1:55000' + path,
        };

        if (token){
            if (!query)
                options.headers = {'Cookie': ['happn_token=' + token]}
            else
                options.url += '?happn_token=' + token;
        }

        request(options, function(error, response, body){
            callback(body);
        });

    }

    var httpServer;

    before('it starts up a web server that uses port 55000', function(callback){
        var http = require('http');

        httpServer = http.createServer(function (req, res) {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('TEST OUTPUT');
        }).listen(55000);

        doRequest('/', null, null, function(body){
            expect(body).to.be('TEST OUTPUT');
            callback();
        });

    });

    var serviceInstance;
    var happnInstance;

    it('should initialize the service without listening', function (callback) {

        service.create({
            deferListen:true
        })

        .then(function (serviceInst) {
            serviceInstance = serviceInst;
            callback();
        })

        .catch(callback)

        ;

    });

    xit('should connect to the service with an intra-proc client, perform a set, get and remove', function (callback) {

    });

    it('should stop the service, even though it hasnt started listening', function (callback) {
        serviceInstance.stop(callback);
    });

    it('should initialize the service without listening again', function (callback) {
        service.create({
                deferListen:true
            })

            .then(function (serviceInst) {
                serviceInstance = serviceInst;
                callback();
            })

            .catch(callback)

        ;
    });

    xit('should try and start the service, but fail with EADDRINUSE, then kill the http server, then successfully retry', function (callback) {

    });

    after(function(done) {

        require('benchmarket').stop();

        if (happnInstance)
            happnInstance.stop(done);
        else
            done();
    });

});