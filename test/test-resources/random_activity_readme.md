random activity generator
-------------------------
*takes a happn client at construction time, and performs random activities against the clients happn server. highly configurable - allows for the percentage of gets, sets, removes and ons to be configured. For ons, gets and removes some initial data needs to be created - this is also configurable*

configuration:
--------------
```javascript
var RandomActivity = require('./random_activity_generator');

//the options are the second parameter - the amounts are the default amounts
generator = new RandomActivity(happnClientInstance, {
	interval:20,//in milliseconds, the interval between each new random call
	percentageGets:[0,20],//range out of 100 of gets that are randomly chosen
	percentageSets:[20,80],//range out of 100 of sets that are randomly chosen
	percentageRemoves:[80,90],//range out of 100 of removes that are randomly chosen
	percentageOns:[90,100],//range out of 100 of ons that are randomly chosen
	initialDataRemoveCount:40,//initial data generated for remove calls
	initialDataOnCount:20,//initial data generated for on calls
	initialDataGetCount:50,//initial data generated for get calls
	randomDataSize:3,//the random data object has a bigData property, this setting creates a string of length (32 * 3)
	onTimeout:100//when the verify operation runs, this is the timeout reached when testing ons
});

```

start, stop and verify:
-----------------------
*when you start the random activity, the timespan it takes to generate the initial data is stored - this is so that when you stop the activity, the system waits for that timespan to actually stop - this allows for accuracy that is not affected by the initialization procedure*
```javascript

var happn = require('../../lib/index')
var service = happn.service;
var happn_client = happn.client;

service.create(function(e, instance){
	if (e) return callback(e);
	serviceInstance = instance;

	happn_client.create(function(e, cli){

		if (e) return callback(e);
		clientInstance = cli;

		//instantiate the generator here:
		var RandomActivity = require('./random_activity_generator');
		generator = new RandomActivity(clientInstance);

		//start random activity - we use a key "test" to store the generated log data
		//this is so we can run multiple parallel tests if necessary
		generator.generateActivityStart("test", function(e){

			//wait a while, then stop

			setTimeout(function(){

				//end the generation run
				generator.generateActivityEnd("test", function(aggregatedLog){

					//verify the database state matches the logs
					generator.verify(function(e, log){

						callback();
					},
					"test");//verify the "test" group

				});

			}, 2000);

		})
	});
})

```

replay
-------
*you can create 2 generators, have one do a run, then pass it to another generator (perhaps connected to a different db) - its logs is parsed and exactly the same activity is replicated*

the following is an example [from the test](https://github.com/happner/happn/blob/feature/compaction/test/test-resources/random_activity_generator_test.js#L281)
```javascript
generator.generateActivityStart("test", function(){
	setTimeout(function(){
		generator.generateActivityEnd("test", function(aggregatedLog){

			var RandomActivity = require('./random_activity_generator');
			generator2 = new RandomActivity(clientInstance);
			generator2.replay(generator, "test", function(e, replayLog){

				if (e) return callback(e);

				expect(replayLog.get).to.be(aggregatedLog.get);
				expect(replayLog.set).to.be(aggregatedLog.set);
				expect(replayLog.remove).to.be(aggregatedLog.remove);
				expect(replayLog.on).to.be(aggregatedLog.on);

				callback();

			});

		});

	}, 2000);
});

```

daemon mode
-----------
*this is for testing activity over a long period (days/weeks/months), running in this mode does not store a replay log, and only stores aggregated data related to the run*


following example from the [test](https://github.com/happner/happn/blob/feature/compaction/test/test-resources/random_activity_generator_test.js#L307)
```javascript

generator.generateActivityStart("test", function(){
	setTimeout(function(){
		generator.generateActivityEnd("test", function(aggregatedLog){
			//expect(generator.__operationLog["test"].length).to.be(0);
			//callback();
			//etc...
		});
	}, 2000);
}, "daemon");//NB here is where you set the mode to "daemon"

```

