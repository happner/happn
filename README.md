HAPPN
=====================

Introduction
-------------------------

Happn is an attempt at getting the same kind of functionality that [firebase](https://www.firebase.com/) offers, but it is free. It is a bit different from firebase in terms of it being a searchable key/value store, instead of arranging the data like one big json tree, like firebase does.

Firebase is fricking awesome - but sometimes priced a little out of the reach of certain projects, but if you have the money to throw at it, it is well worth investigating. 

The aim of this framework however is to create an http/json api that sits on top of a mongo backend as the server, which also has pub/sub baked in - so you can subscribe to changes in the data via the client - which can be used from a browser or from a node program, depending on how it is initialized.

Technologies used:
Happn uses [Primus](https://github.com/primus/primus) to power websockets for its pub/sub framework and mongo or nedb depending on the mode it is running in as its data store, the API uses [connect](https://github.com/senchalabs/connect).

The system uses [jwt](https://github.com/hokaccha/node-jwt-simple) to secure session state between calls.

Happn has 3 modes:
-----------------------

embedded:
---------

This is the easiest setup, as the system uses nedb to store data internally, so you dont need mongo or redis running on your machine. You can just spin up an instance and start pushing data to it and listening for changes via the client.

* NB - the search functionality works slightly differently in embedded mode, $all is not supported, and nested columns like data.firstname dont work, when you try and limit the columns returned - you'll see what I mean if you look at the tests *

cluster: 
--------

You can specify how many worker processes you want the system to use, so we can scale to multicore machines.
You need a redis instance and a mongo instance for this mode, this is because Faye uses it's redis engine to keep state across clustered instances of the Happn worker process.

CLUSTER AINT WORKING ANYMORE - DUE TO MIGRATION TO MIGRATION AND FULL DUPLEX WEBSOCKETS... Busy fixing.

single process:
---------------

The system runs as a single process, but still needs a mongo db instance running for storing data.

SINGLE PROCESS AINT WORKING ANYMORE - DUE TO MIGRATION TO MIGRATION AND FULL DUPLEX WEBSOCKETS... Busy fixing.

additional info
---------------

Happn stores its data in a collection called 'happn' by default on your mongodb. The happn system is actually built to be a module, this is because the idea is that you will be able to initialize a server in your own code, and possibly attach your own plugins to various system events. So the requirements and installation instructions show you how to reference happn and write the code that starts the instance up. This won't be a tremendously detailed document - so please do spelunk and get involved.

Requirements & instructions
---------------------------

You need NodeJS and NPM of course, you also need to know how node works (as my setup instructions are pretty minimal)

You need to install mocha to run the tests, ie: sudo npm install mocha -g --save

If you want to run in cluster mode, you need to install [Redis](http://redis.io/topics/quickstart) and have it up and running, on its standard port: 6379

If you want to run in cluster or single process mode, you need to install [Mongo](http://docs.mongodb.org/manual/installation/) and have it up and running on its standard port: 27017

You can just clone this repository, then run "npm install" and then run "mocha test/e2e_test" to see how things work, there are 17 unit tests there that execute against happn service running in embedded mode, they should all pass... 

But if you want to run your own service do the following:

Create a directory you want to run your happn in, create a node application in it - with some kind of main.js and a package.json

I havent had the time to join npm yet, so add the following dependancy to your package.json:

```javascript
"dependencies": {
    "happn": "git+https://github.com/southbite/happn-primus.git"
  }
```
To get the latest happn files run:
npm install

*In node_modules/happn/test in your folder, the e2e_test.js script demonstrates the server and client interactions shown in the following code snippets*

To start up a happn, add following to your main.js:
-------------------------------------------------------

```javascript
var happn = require('../lib/index')
var service = happn.service;
var happn_client = happn.client;

//runs off port 8000 by default
//Embedded mode (no external databases necessary): 
service.initialize(
{mode:'embedded', 
	services:{
		auth:{
			path:'./services/auth/service.js',
			config:{
				authTokenSecret:'a256a2fd43bf441483c5177fc85fd9d3',
				systemSecret:'test_secret'
			}
		},
		data:{
			path:'./services/data_embedded/service.js',
			config:{}
		},
		pubsub:{
			path:'./services/pubsub/service.js',
			config:{}
		}
	},
	utils:{
		logLevel:'info',  // possibles: off, fatal, error, warn, info, debug, trace 
		logComponents: ['prepare'],
		logFile: '/absolute/path.log'
	}
}, 
function(e){
	callback(e);
});

//Cluster mode (needs redis and mongo): 
[TBD]

```

In your console, go to your application folder and run *node main* your server should start up and be listening on your port of choice.

Connecting to Happn
-------------------------

Using node:

```javascript
 var happn = require('happn'); 
 var happn_client = happn.client; 
 var my_client_instance; 

 	my_client_instance = new happn.client({config:{host:'localhost', port:testport, secret:test_secret}}, function(e){
        callback(e);
    });

```

To use the browser client, make sure the server is running, and reference the client javascript with the url pointing to the running server instances port and ip address like so:

```html
<script type="text/javascript" src="http://localhost:8000/browser_client"></script>
<script>

var my_client_instance; 

my_client_instance = new happn.client({config:{host:'localhost', port:testport, secret:test_secret}}, function(e){
	if (e) throw e;

	//my_client_instance.get...
    //my_client_instance.set...
    //my_client_instance.on...

});

</script>
```

PUT
-------------------------

*Puts the json in the branch e2e_test1/testsubscribe/data, creates the branch if it does not exist*

```javascript

//the noPublish parameter means this data change wont be published to other subscribers, it is false by default
//there are a bunch other parameters - like noStore (the json isnt persisted, but the message is published)

my_client_instance.set('e2e_test1/testsubscribe/data/', {property1:'property1',property2:'property2',property3:'property3'}, {noPublish:true}, function(e, result){

	

});

```

*NB - by setting the option merge:true, the data at the end of the path is not overwritten by your json, it is rather merged with the data in your json, overwriting the fields you specify in your set data, but leaving the fields that are already at that branch.*

PUT CHILD
-------------------------

*Posts your data to a collection that lives at the end of the specified branch (creates the collection if it doesnt exist), the getChild method will fetch your data back*

```javascript
my_client_instance.setChild('e2e_test1/testsubscribe/data/collection', {property1:'post_property1',property2:'post_property2'}, function(e, results){

					if (!e){
						//the child method returns a child in the collection with a specified id
						my_client_instance.getChild('e2e_test1/testsubscribe/data/collection', results.payload._id, function(e, results){
```

PUT SIBLING
-------------------------

*Posts your data to a unique path starting with the path you passed in as a parameter*

```javascript
	my_client_instance.setSibling('e2e_test1/siblings', {property1:'sib_post_property1',property2:'sib_post_property2'}, function(e, results){
		//you would get all siblings by querying the path e2e_test1/siblings*
```

GET
---------------------------

*Gets the data living at the specified branch, gets the whole collection if the data is a collection, see the child method (above) for getting a specific item from a collection*

```javascript
my_client_instance.get('e2e_test1/testsubscribe/data', 
	null, //options
	function(e, results){
	//results is your data
	console.log(results.payload.length);//payload is now an array containing all the results for your get, get can also use a wildcard * in the path ie. publisherclient.get('e2e_test1/testsubscribe/data*'...
```

*You can also use wildcards, gets all items with the path starting e2e_test1/testsubscribe/data *

```javascript
my_client_instance.get('e2e_test1/testsubscribe/data*', 
	null, 
	function(e, results){
	//results is your data
	console.log(results.payload.length);//payload is now an array containing all the results for your get, get can also use a wildcard * in the path ie. publisherclient.get('e2e_test1/testsubscribe/data*'...
```

*You can also just get paths and ids, without data *

```javascript
my_client_instance.getPaths('e2e_test1/testwildcard/*', function(e, results){
```

SEARCH
---------------------------

*You can pass mongo style search parameters to look for data sets within specific key ranges*

```javascript

	parameters1 = {
		criteria:{
			$or: [ {"data.regions": { $in: ['North','South','East','West'] }}, 
				   {"data.towns": { $in: ['North.Cape Town', 'South.East London'] }}, 
				   {"data.categories": { $in: ["Action","History" ] }}],
			"data.keywords": {$in: ["bass", "Penny Siopis" ]}
		},
		fields:{"data":1},
		sort:{"data.field1":1},
		limit:1
	}

	my_client_instance.search('/e2e_test1/testsubscribe/data/complex*', parameters1, function(e, search_result){

```

DELETE
---------------------------

*Deletes the data living at the specified branch, if a child_id is specified, the child from the collection at the end of the branch is deleted*

```javascript
	my_client_instance.remove('/e2e_test1/testsubscribe/data/delete_me', null, function(e, result){
	if (!e)
		//your item was deleted, result.payload is an object that lists the amount of objects deleted
```

DELETE CHILD
----------------------------

*Deletes a child from an array living at a branch *

```javascript
//first we put
my_client_instance.setChild('/e2e_test1/testsubscribe/data/catch_all_array', {property1:'property1',property2:'property2',property3:'property3'}, function(e, post_result){
	if (!e){
		//your item was added to a collection, now remove it
		my_client_instance.removeChild('/e2e_test1/testsubscribe/data/catch_all_array', post_result.payload._id, function(e, del_ar_result){

								
```

EVENTS
----------------------------

*You can listen to any SET & REMOVE events happeneing in your data - you can specifiy a path you want to listen on or you can listen to all PUT, POST and DELETE using a catch-all listener*

Specific listener:
```javascript
my_client_instance.on('/e2e_test1/testsubscribe/data/delete_me', //the path you are listening on
					  {event_type:'remove', // either set, remove or all - defaults to all
					   count:0},// how many times you want your handler to handle for before it is removed - default is 0 (infinity)
					  function(e, message){ //your listener event handler
```

Catch all listener:
```javascript
my_client_instance.onAll(function(e, message){

			//message consists of action property - set, remove
			//and payload property - the actual data that got PUT, POSTED - or the _id of the data that got DELETED


		}, function(e){

```

TAGGING
----------------------------

*You can do a set command and specify that you want to tag the data at the end of the path (or the data that is created as a result of the command), tagging will take a snapshot of the data as it currently stands, and will save the snapshot to a path that starts with the path you specify, and a '/' with the tag you specify at the end *

```javascript

var randomTag = require('shortid').generate();

my_client_instance.set('e2e_test1/test/tag', {property1:'property1',property2:'property2',property3:'property3'}, {tag:randomTag}, function(e, result){

```

MERGING
----------------------------

*You can do a set command and specify that you want to merge the json you are pushing with the existing dataset, this means any existing values that are not in the set json but exist in the database are persisted and not overwritten*

```javascript

my_client_instance.set('e2e_test1/testsubscribe/data/', {property1:'property1',property2:'property2',property3:'property3'}, {merge:true}, function(e, result){

});

```

