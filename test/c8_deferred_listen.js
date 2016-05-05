

describe('c8_deferred_listen', function () {

    require('benchmarket').start();
    after(require('benchmarket').store());

    var expect = require('expect.js');
    var happn = require('../lib/index')
    var service = happn.service;
    var happn_client = happn.client;

    this.timeout(120000);

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

    var happnInstance;

    it('should initialize the service without listening', function (callback) {

        service.create({
            deferListen:true
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
        happn_client.create({
            plugin: happn.client_plugins.intra_process,
            context: happnInstance
        }, function(e, instance) {
            if (e) return callback(e);
            intraProcClientInstance = instance;

            intraProcClientInstance.set('/test/', {"test":"data"}, function(e, response){
                if (e) return callback(e);

                intraProcClientInstance.get('/test/', function(e, response){
                    if (e) return callback(e);

                    expect(response.test).to.be('data');

                    intraProcClientInstance.remove('/test/', function(e, response){
                        if (e) return callback(e);
                        expect(response.removed).to.be(1);
                        callback();
                    });
                })

            });

        });
    });

    it('should stop the service, even though it hasnt started listening', function (callback) {
        happnInstance.stop(callback);
    });

    it('should initialize the service without listening again', function (callback) {
        service.create({
                deferListen:true
            })

            .then(function (happnInst) {
                happnInstance = happnInst;
                callback();
            })

            .catch(callback)

        ;
    });

    it('should try and start the service, but fail with EADDRINUSE, then kill the http server, then successfully retry', function (callback) {
        happnInstance.listen(function(e){
            console.log('listen err:::', JSON.stringify(e));
            expect(e).to.not.be(null);
            httpServer.close();
            setTimeout(function(){

                console.log('trying again:::');

                happnInstance.listen(function(e){
                    console.log('trying again err:::', JSON.stringify(e));
                    expect(e).to.be(null);
                    callback();
                });

            }, 5000);

        })
    });

    after(function(done) {

        require('benchmarket').stop();

        if (happnInstance)
            happnInstance.stop(done);
        else
            done();
    });

});