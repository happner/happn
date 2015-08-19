var expect = require('expect.js');
var happn = require('../lib/index')
var gateway = happn.service;
var device1 = happn.service;
var device2 = happn.service;
var happn_client = happn.client;
var async = require('async');

describe('e2e test', function() {

	var gatewayPort = 8000;
	var device1Port = 8001;
	var device2Port = 8001;

	var test_secret = 'test_secret';
	var mode = "embedded";

	var default_timeout = 4000;

	var initializeService = function(instance, port, callback){
		instance.initialize({
				"port":port,
				mode:'embedded', 
				services:{
					auth:{
						path:'./services/auth/service.js',
						config:{
							authTokenSecret:'a256a2fd43bf441483c5177fc85fd9d3',
							systemSecret:test_secret
						}
					},
					data:{
						path:'./services/data_embedded/service.js',
						config:{}
					}
				},
				utils:{
					log_level:'info|error|warning',
					log_component:'prepare'
				}
			},
			callback
		);
	}

	it('should initialize the services', function(callback) {
		
		this.timeout(20000);

		try{

			initializeService(gateway, gatewayPort, function(e){
				if (e) return callback(e);

				initializeService(device1, device1Port, function(e){
					if (e) return callback(e);

					initializeService(device2, device2Port, function(e){
						if (e) return callback(e);

					});
				});
			});

		}catch(e){
			callback(e);
		}
	});

	it('should register the device1 mesh as a proxy to the gateway', function(callback) {

		device.services.proxy.registerWebSocket({
				host:'127.0.0.1',//will default to local anyhow
				port:gatewayPort,
				paths:[ //we get the gateway to proxy any requests on these paths to the device
					'/device1/setValue',
					'/device1/cameraFeed',
					'/settings',
					'/events'
				]
			}, 
			function(e){
				if (e) return callback(e);

				expect(gateway.services.proxy.targets.count).to.be(1);
				expect(gateway.services.proxy.targets[0].type == 'WebSocket').to.be(true);

				device.services.proxy.registerWebSocket(
				{
						host:'127.0.0.1',//will default to local anyhow
						port:gatewayPort,
						paths:[ //we get the gateway to proxy any requests on these paths to the device
							'/device2/setValue',
							'/device2/cameraFeed',
							'/settings',
							'/events'
						]
					}, 
					function(e){
						if (e) return callback(e);

						expect(gateway.services.proxy.targets.count).to.be(2);
						expect(gateway.services.proxy.targets[1].type == 'WebSocket').to.be(true);
					}
				);
			}
		);

	});

	var externalclient;// a client that is connecting to the device, via the gateway
	var internalclient;// a client that connect directly to the device
	var gatewayclient;// a client that connects to the gateway for services on the gateway (non proxied requests)

	it('should initialize the clients', function(callback) {
		this.timeout(default_timeout);

		try{
		  //plugin, config, context, 

		  externalclient = new happn.client({config:{port:gatewayPort, secret:test_secret}}, function(e){

		    if (e)
		      return callback(e);

		    internalclient = new happn.client({config:{port:devicePort, secret:test_secret}}, function(e){

		    	 if (e)
		      		return callback(e);

		      	gatewayclient = new happn.client({config:{port:gatewayPort, secret:test_secret}}, callback);
		    });

		  });

		}catch(e){
		  callback(e);
		}
	});

	it('should do a proxy round trip from the external client', function(callback) {
		this.timeout(default_timeout);

		try{

		 	var testValue = Math.random();
			  //plugin, config, context, 
			  externalclient.on('/device1/setValue', {event_type:'set', count:1}, function(message){
		  		//check the message here

				callback();

			}, function(e){

				if (!e){

					externalclient.set('/device1/setValue', {value:testValue}, null, function(e, result){
						console.log('set happened - listening for result');
					});
				}else
					callback(e);
			});
		 

		}catch(e){
		  callback(e);
		}
	});

	//so the message is proxied to all devices behind the gateway and the responses on each device streamed back
	it('should do a proxy broadcast', function(callback) {
		this.timeout(default_timeout);

		try{

			var responseCount = 0;

			externalclient.set('/events', {value:testValue}, null, function(e, result){
				
				if (e) return callback(e);

				responseCount++;

				if (responseCount == 2)
					callback();

			});

		}catch(e){
		  callback(e);
		}
	});

	//any devices listenings for requests on the settings path, return their values - which are streamed as part of the response
	it('should do a proxy read multiple', function(callback) {
		this.timeout(default_timeout);

		try{

			var responseCount = 0;

			externalclient.get('/settings', null, function(e, results){
				
				if (e) return callback(e);

				responseCount++;

				if (responseCount == 2)
					callback();

			});

		}catch(e){
		  callback(e);
		}
	});

});