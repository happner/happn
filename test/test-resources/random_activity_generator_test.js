var expect = require('expect.js');
var happn = require('../../lib/index')
var service = happn.service;
var happn_client = happn.client;
var serviceInstance;
var clientInstance;

describe('random_activity_generator', function() {

	var generator;

	it('instantiates the generator', function (callback) {

		service.create(function(e, instance){
			if (e) return callback(e);
			serviceInstance = instance;

			happn_client.create(function(e, cli){

				if (e) return callback(e);
				clientInstance = cli;
				var RandomActivity = require('./random_activity_generator');

				generator = new RandomActivity(clientInstance);
				callback();
			});
		})

	});

	it('initializes the activity log', function (callback) {

		var log = generator.__initializeActivity('test');
		expect(log.initialRemove).to.be(0);
		expect(log.initialOn).to.be(0);
		expect(log.gets).to.be(0);
		expect(log.sets).to.be(0);
		expect(log.removes).to.be(0);
		expect(log.ons).to.be(0);
		callback();

	});

	it('generates a random path', function (callback) {
		var path = generator.__generateRandomPath('test');
		console.log(path);
		//
		expect(path).to.not.be(null);
		expect(path.indexOf("/random_activity_generator/test/")).to.be(0);
		callback();
	});

	it('generates a random data item', function (callback) {
		var data = generator.__generateRandomData('test');
		console.log(data);
		expect(data).to.not.be(null);
		expect(data.bigData.length).to.be(32 * 3);
		callback();
	});

	it('creates initial data', function (callback) {

		generator.__generateInitialData('test', function(e, log){
			if (e) return callback(e);
			console.log(log);
			expect(log.initialRemove).to.be(40);
			expect(log.initialOn).to.be(20);
			callback();
		});

	});

	it('creates random operation types', function (callback) {
		var operationTypes = {};

		for(var i = 0;i < 100;i++){
			var opType = generator.__getRandomOperationType();
			if (!operationTypes[opType])
				operationTypes[opType] = 1;
			else
				operationTypes[opType]++;
		}
		console.log(operationTypes);
		expect(operationTypes['get'] <= 25).to.be(true);
		expect(operationTypes['set'] <= 70).to.be(true);
		expect(operationTypes['remove'] <= 20).to.be(true);
		expect(operationTypes['on'] <= 20).to.be(true);
		callback();
	});

	it('can do a log update', function (callback) {
		var logUpdate = generator.__updateLog("test", {"test":"logitem"}, {"test":"payload"}, "test error");
		expect();
	});

	it('can do a set operation', function (callback) {
		var operationLogItem = {
          opType:"set",
          path:generator.__generateRandomPath('test'),
          data:generator.__generateRandomData('test')
        };

        generator.__doOperation
	});

	it('can do a get operation', function (callback) {

	});

	it('can do an on operation', function (callback) {

	});

	it('can do a remove operation', function (callback) {

	});

});