var expect = require('expect.js');
var happn = require('../lib/index')
var service = happn.service;
var happn_client = happn.client;
var async = require('async');

describe('e2e test', function() {

	var test_secret = 'test_secret';
	var mode = "embedded";
	var default_timeout = 4000;

	/*
	This test demonstrates starting up the happn service - 
	the authentication service will use authTokenSecret to encrypt web tokens identifying
	the logon session. The utils setting will set the system to log non priority information
	*/

	before('should initialize the service', function(callback) {
		
		this.timeout(20000);

		try{
			service.create({
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
						},
						pubsub:{
							path:'./services/pubsub/service.js',
							config:{}
						}
					},
					utils:{
						log_level:'info|error|warning',
						log_component:'prepare'
					}
				}, 
				function(e){
					callback(e);
				});
		}catch(e){
			callback(e);
		}
	});

  // after(function(done) {
  //   happnInstance.stop(done);
  // });

	var publisherclient;
	var listenerclient;

	/*
  	We are initializing 2 clients to test saving data against the database, one client will push data into the 
  	database whilst another listens for changes.
	*/
	it('should initialize the clients', function(callback) {
	    this.timeout(default_timeout);

	    try {
	      happn_client.create({config:{secret:test_secret}}, function(e, instance) {

	        if (e) return callback(e);

	        publisherclient = instance;
	        happn_client.create({config:{secret:test_secret}}, function(e, instance) {

	          if (e) return callback(e);
	          listenerclient = instance;
	          callback();

	        });

	      });

	    } catch (e) {
	      callback(e);
	    }

	 });

	it('the publisher should set new data ', function(callback) {
		
		this.timeout(default_timeout);

		try{
			var test_path_end = require('shortid').generate();

			publisherclient.set('e2e_test1/testsubscribe/data/' + test_path_end, {property1:'property1',property2:'property2',property3:'property3'}, {noPublish:true}, function(e, result){
			
				////////////console.log('set happened');
				////////////console.log([e, result]);

				if (!e){
					publisherclient.get('e2e_test1/testsubscribe/data/' + test_path_end, null, function(e, results){
						////////////console.log('new data results');
						//console.log([e, results]);

						expect(results.payload.length == 1).to.be(true);
						expect(results.payload[0].data.property1 == 'property1').to.be(true);

						if (mode != 'embedded')
							expect(results.payload[0].created == results.payload[0].modified).to.be(true);

						callback(e);
					});
				}else
					callback(e);
			});

		}catch(e){
			callback(e);
		}
	});


	it('should set data, and then merge a new document into the data without overwriting old fields', function(callback) {
		
		this.timeout(default_timeout);

		try{

			var test_path_end = require('shortid').generate();

			publisherclient.set('e2e_test1/testsubscribe/data/merge/' + test_path_end, {property1:'property1',property2:'property2',property3:'property3'}, null, function(e, result){
			
				if (e)
					return callback(e);

				//////////////console.log('set results');
				//////////////console.log(result);

				publisherclient.set('e2e_test1/testsubscribe/data/merge/' + test_path_end, {property4:'property4'}, {merge:true}, function(e, result){

					if (e)
						return callback(e);

					//////////////console.log('merge set results');
					//////////////console.log(result);

					publisherclient.get('e2e_test1/testsubscribe/data/merge/' + test_path_end, null, function(e, results){

						if (e)
							return callback(e);

						//////////////console.log('merge get results');
						//////////////console.log(results);

						expect(results.payload[0].data.property4).to.be('property4');
						expect(results.payload[0].data.property1).to.be('property1');
						
						callback();

					});  

				});
				
			});

		}catch(e){
			callback(e);
		}
	});



	it('should search for a complex object', function(callback) {

		//////////////////////////console.log('DOING COMPLEX SEARCH');

		var test_path_end = require('shortid').generate();

		var complex_obj = {
			regions:['North','South'],
			towns:['North.Cape Town'],
			categories:['Action','History'],
			subcategories:['Action.angling','History.art'],
			keywords:['bass','Penny Siopis'],
			field1:'field1'
		};

		
		var criteria1 = {
				$or: [ {"data.regions": { $in: ['North','South','East','West'] }}, 
					   {"data.towns": { $in: ['North.Cape Town', 'South.East London'] }}, 
					   {"data.categories": { $in: ["Action","History" ] }}],
				"data.keywords": {$in: ["bass", "Penny Siopis" ]}}

		var	options1 = {fields:{"data":1},
			sort:{"data.field1":1},
			limit:1}

		var criteria2 = null;
				
		var	options2 = {fields:null,
			sort:{"field1":1},
			limit:2}

		publisherclient.set('/e2e_test1/testsubscribe/data/complex/' + test_path_end, complex_obj, null, function(e, put_result){
			expect(e == null).to.be(true);
			publisherclient.set('/e2e_test1/testsubscribe/data/complex/' + test_path_end + '/1', complex_obj, null, function(e, put_result){
				expect(e == null).to.be(true);

				////////////console.log('searching');
				publisherclient.get('/e2e_test1/testsubscribe/data/complex*', {criteria:criteria1, options:options1}, function(e, search_result){

					////////////console.log([e, search_result]);

					expect(e == null).to.be(true);
					expect(search_result.payload.length == 1).to.be(true);

					publisherclient.get('/e2e_test1/testsubscribe/data/complex*', {criteria:criteria2, options:options2}, function(e, search_result){

						expect(e == null).to.be(true);
						expect(search_result.payload.length == 2).to.be(true);

						callback(e);
					});

				});

			});

		});

	});




	it('should delete some test data', function(callback) {

		this.timeout(default_timeout);

		try{

			//We put the data we want to delete into the database
			publisherclient.set('/e2e_test1/testsubscribe/data/delete_me', {property1:'property1',property2:'property2',property3:'property3'}, {noPublish:true}, function(e, result){

				//We perform the actual delete
				publisherclient.remove('/e2e_test1/testsubscribe/data/delete_me', {noPublish:true}, function(e, result){

					expect(e).to.be(null);
					expect(result.status).to.be('ok');

					////////////////////console.log('DELETE RESULT');
					////////////////////console.log(result);
					
					callback();
				});
					
			});

		}catch(e){
			callback(e);
		}

	});

	it('the publisher should set new data then update the data', function(callback) {
		
		this.timeout(default_timeout);

		try{
			var test_path_end = require('shortid').generate();

			publisherclient.set('e2e_test1/testsubscribe/data/' + test_path_end, {property1:'property1',property2:'property2',property3:'property3'}, {noPublish:true}, function(e, insertResult){
			
				expect(e).to.be(null);

				publisherclient.set('e2e_test1/testsubscribe/data/' + test_path_end, {property1:'property1',property2:'property2',property3:'property3', property4:'property4'}, {noPublish:true}, function(e, updateResult){

					expect(e).to.be(null);
					expect(updateResult._id == insertResult._id).to.be(true);
					callback();

				});

			});

		}catch(e){
			callback(e);
		}
	});


	it('should merge tag some test data', function(callback) {

		var randomTag = require('shortid').generate();

		publisherclient.set('e2e_test1/test/tag', {property1:'property1',property2:'property2',property3:'property3'}, {noPublish:true}, function(e, result){

			////////////////////console.log('did set');
			////////////////////console.log([e, result]);

			if (!e){

			publisherclient.set('e2e_test1/test/tag', {property4:'property4'}, {tag:randomTag, merge:true, noPublish:true}, function(e, result){

				if (!e){

					////////////////////console.log('merge tag results');
					////////////////////console.log(e);
					////////////////////console.log(result);

					expect(result.payload[0].snapshot.data.property1).to.be('property1');
					expect(result.payload[0].snapshot.data.property4).to.be('property4');

					publisherclient.get('e2e_test1/test/tag/tags/*', null, function(e, results){

						expect(e).to.be(null);
						expect(results.payload.length > 0).to.be(true);
						
						var found = false;

						results.payload.map(function(tagged){

							if (found)
								return;

							if (tagged.snapshot.tag == randomTag){
								expect(tagged.snapshot.data.property1).to.be('property1');
								expect(tagged.snapshot.data.property4).to.be('property4');
								found = true;
							}
			
						});

						if (!found)
							callback('couldn\'t find the tag snapshot');
						else
							callback();

					});
				}else
					callback(e);

			});

		}
		else
			callback(e);

			
		});

	});



//	We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

	it('the listener should pick up a single published event', function(callback) {
		
		this.timeout(default_timeout);

		try{

			//first listen for the change
			listenerclient.on('/e2e_test1/testsubscribe/data/event', {event_type:'set', count:1}, function(message){

				expect(listenerclient.events['/SET@/e2e_test1/testsubscribe/data/event'].length).to.be(0);
				callback();

			}, function(e){

				//////////////////console.log('ON HAS HAPPENED: ' + e);

				if (!e){

					expect(listenerclient.events['/SET@/e2e_test1/testsubscribe/data/event'].length).to.be(1);
					//////////////////console.log('on subscribed, about to publish');

					//then make the change
					publisherclient.set('/e2e_test1/testsubscribe/data/event', {property1:'property1',property2:'property2',property3:'property3'}, null, function(e, result){
						////////////////////////////console.log('put happened - listening for result');
					});
				}else
					callback(e);
			});

		}catch(e){
			callback(e);
		}
	});



	//We are testing setting data at a specific path

	it('the publisher should set new data ', function(callback) {
		
		this.timeout(default_timeout);

		try{
			var test_path_end = require('shortid').generate();

			publisherclient.set('e2e_test1/testsubscribe/data/' + test_path_end, {property1:'property1',property2:'property2',property3:'property3'}, null, function(e, result){
			
				if (!e){
					publisherclient.get('e2e_test1/testsubscribe/data/' + test_path_end, null, function(e, results){
						////////////////////////console.log('new data results');
						////////////////////////console.log(results);
						expect(results.payload.length == 1).to.be(true);
						expect(results.payload[0].data.property1 == 'property1').to.be(true);

						if (mode != 'embedded')
							expect(results.payload[0].created == results.payload[0].modified).to.be(true);

						callback(e);
					});
				}else
					callback(e);
			});

		}catch(e){
			callback(e);
		}
	});



	it('the publisher should set new data then update the data', function(callback) {
		
		this.timeout(default_timeout);

		try{
			var test_path_end = require('shortid').generate();

			publisherclient.set('e2e_test1/testsubscribe/data/' + test_path_end, {property1:'property1',property2:'property2',property3:'property3'}, null, function(e, insertResult){
			
				expect(e == null).to.be(true);

				publisherclient.set('e2e_test1/testsubscribe/data/' + test_path_end, {property1:'property1',property2:'property2',property3:'property3', property4:'property4'}, null, function(e, updateResult){

					expect(e == null).to.be(true);
					expect(updateResult._id == insertResult._id).to.be(true);
					callback();

				});

			});

		}catch(e){
			callback(e);
		}
	});



	it('the publisher should push to a collection and get a child', function(callback) {
		
		this.timeout(default_timeout);

		try{
				var test_path_end = require('shortid').generate();

				publisherclient.setChild('e2e_test1/testsubscribe/data/collection/' + test_path_end, {property1:'post_property1',property2:'post_property2'}, function(e, results){

					if (!e){
						//the child method returns a child in the collection with a specified id
						publisherclient.getChild('e2e_test1/testsubscribe/data/collection/' + test_path_end, results.payload._id, function(e, results){
							expect(results.payload.length == 1).to.be(true);
							callback(e);
						});

					}else
						callback(e);

				});
					

		}catch(e){
			callback(e);
		}
	});

	//We are testing pushing a specific value to a path which will actually become an array in the database

	it('the publisher should push a sibling and get all siblings', function(callback) {
		
		this.timeout(default_timeout);

		try{

			var test_path_end = require('shortid').generate();	

			publisherclient.setSibling('e2e_test1/siblings/' + test_path_end, {property1:'sib_post_property1',property2:'sib_post_property2'}, function(e, results){

				expect(e == null).to.be(true);

				publisherclient.setSibling('e2e_test1/siblings/' + test_path_end, {property1:'sib_post_property1',property2:'sib_post_property2'}, function(e, results){

					expect(e == null).to.be(true);

					//the child method returns a child in the collection with a specified id
					publisherclient.get('e2e_test1/siblings/' + test_path_end + '/*', null, function(e, getresults){
						expect(e == null).to.be(true);
						expect(getresults.payload.length == 2).to.be(true);
						callback(e);
					});
				});
			});

		}catch(e){
			callback(e);
		}
	});



//	We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

	it('the listener should pick up a single published event', function(callback) {
		
		this.timeout(default_timeout);

		try{

			//first listen for the change
			listenerclient.on('/e2e_test1/testsubscribe/data/event', {event_type:'set', count:1}, function(message){

				expect(listenerclient.events['/SET@/e2e_test1/testsubscribe/data/event'].length).to.be(0);
				callback();

			}, function(e){

				if (!e){

					expect(listenerclient.events['/SET@/e2e_test1/testsubscribe/data/event'].length).to.be(1);

					////////////////////////////console.log('on subscribed, about to publish');

					//then make the change
					publisherclient.set('/e2e_test1/testsubscribe/data/event', {property1:'property1',property2:'property2',property3:'property3'}, null, function(e, result){
						////////////////////////////console.log('put happened - listening for result');
					});
				}else
					callback(e);
			});

		}catch(e){
			callback(e);
		}
	});



//	We are testing the deletion of data at a set path, and listening for the DELETE event at that path.



	it('should delete a child from an array', function(callback) {
		
		this.timeout(default_timeout);

		try{

				publisherclient.setChild('/e2e_test1/testsubscribe/data/arr_delete_me', {property1:'property1',property2:'property2',property3:'property3'}, function(e, post_result){

					//////////////////////////console.log('post_result');
					//////////////////////////console.log(post_result);

					expect(e == null).to.be(true);

					publisherclient.get('/e2e_test1/testsubscribe/data/arr_delete_me', null, function(e, results){

						expect(e == null).to.be(true);
						expect(results.payload.length).to.be(1);

						publisherclient.removeChild('/e2e_test1/testsubscribe/data/arr_delete_me', post_result.payload._id, function(e, delete_result){

							expect(e == null).to.be(true);

							publisherclient.get('/e2e_test1/testsubscribe/data/arr_delete_me', null, function(e, results){

								expect(e == null).to.be(true);

								var foundChild = false;
								results.payload[0].data.map(function(child){
									if (child._id == post_result.payload._id)
										foundChild = true;
								});

								expect(foundChild).to.be(false);
								callback();

							});
						});
					});
				});

		}catch(e){
			callback(e);
		}
	});



	it('should get using a wildcard', function(callback) {

		var test_path_end = require('shortid').generate();

		publisherclient.set('e2e_test1/testwildcard/' + test_path_end, {property1:'property1',property2:'property2',property3:'property3'}, null, function(e, insertResult){
			expect(e == null).to.be(true);
			publisherclient.set('e2e_test1/testwildcard/' + test_path_end + '/1', {property1:'property1',property2:'property2',property3:'property3'}, null, function(e, insertResult){
				expect(e == null).to.be(true);
			
				publisherclient.get('e2e_test1/testwildcard/' + test_path_end + '*', null, function(e, results){
					
					expect(results.payload.length == 2).to.be(true);

					publisherclient.getPaths('e2e_test1/testwildcard/' + test_path_end + '*', function(e, results){

						expect(results.payload.length == 2).to.be(true);
						callback(e);

					});
				});
			});
		});
	});




	it('should tag some test data', function(callback) {

		var randomTag = require('shortid').generate();

		publisherclient.set('e2e_test1/test/tag', {property1:'property1',property2:'property2',property3:'property3'}, {tag:randomTag}, function(e, result){

			if (!e){
				publisherclient.get('e2e_test1/test/tag/tags/*', null, function(e, results){

					expect(e).to.be(null);
					expect(results.payload.length > 0);

					var found = false;

					results.payload.map(function(tagged){

						if (found)
							return;

						if (tagged.snapshot.tag == randomTag)
							found = true;

					});

					if (!found)
						callback('couldn\'t find the tag snapshot');
					else
						callback();

				});
			}else
				callback(e);
		});

	});	

	

	it('should save by id, then search and get by id, using bsonid property', function(callback) {

		var randomPath = require('shortid').generate();

		publisherclient.set('e2e_test1/test/bsinid/' + randomPath, {property1:'property1',property2:'property2',property3:'property3'}, {}, function(e, setresult){

			if (!e){

				////////////////////////console.log(setresult);

				var searchcriteria = {'_id': {$in: [{bsonid:setresult.payload._id}]}};

				publisherclient.get('e2e_test1/test/bsinid/*' , {criteria:searchcriteria}, function(e, results){

					expect(e).to.be(null);
					////////////////////////console.log(results);
					expect(results.payload.length == 1).to.be(true);
					expect(results.payload[0].data.property1).to.be('property1');

					callback();

				});
			}else
				callback(e);
		});

	});	

	it('the listener should pick up a single delete event', function(callback) {
		
		this.timeout(default_timeout);

		try{

				//We put the data we want to delete into the database
				publisherclient.set('/e2e_test1/testsubscribe/data/delete_me', {property1:'property1',property2:'property2',property3:'property3'}, null, function(e, result){

					//////////////////console.log('did delete set');
					//path, event_type, count, handler, done
					//We listen for the DELETE event
					listenerclient.on('/e2e_test1/testsubscribe/data/delete_me', {event_type:'remove', count:1}, function(eventData){

						////console.log('on count 1 delete ');
						//////////////////console.log(message);

						//we are looking at the event internals on the listener to ensure our event management is working - because we are only listening for 1
						//instance of this event - the event listener should have been removed 
						////console.log('listenerclient.events');
						////console.log(listenerclient.events);
						expect(listenerclient.events['/REMOVE@/e2e_test1/testsubscribe/data/delete_me'].length).to.be(0);

						////console.log(eventData);

						//we needed to have removed a single item
						expect(eventData.payload.removed).to.be(1);

						////////////////////////////console.log(message);

						callback();

					}, function(e){

						////////////console.log('ON HAS HAPPENED: ' + e);

						if (!e){
							////console.log('listenerclient.events, pre');
							////console.log(listenerclient.events);
							expect(listenerclient.events['/REMOVE@/e2e_test1/testsubscribe/data/delete_me'].length).to.be(1);

							//////////////////console.log('subscribed, about to delete');

							//We perform the actual delete
							publisherclient.remove('/e2e_test1/testsubscribe/data/delete_me', null, function(e, result){

								
									//////////////////console.log('REMOVE HAPPENED!!!');
									//////////////////console.log(e);
									//////////////////console.log(result);
								

								////////////////////////////console.log('put happened - listening for result');
							});
						}else
							callback(e);
					});
				});

			

		}catch(e){
			callback(e);
		}
	});

	it('should unsubscribe from an event', function(callback) {

		var currentListenerId;

		listenerclient.on('/e2e_test1/testsubscribe/data/on_off_test', {event_type:'set', count:0}, function(message){

			//we detach all listeners from the path here
			////console.log('ABOUT OFF PATH');
			listenerclient.off('/e2e_test1/testsubscribe/data/on_off_test', function(e){

				if (e)
					return callback(new Error(e));

				listenerclient.on('/e2e_test1/testsubscribe/data/on_off_test', {event_type:'set', count:0}, 
				function(message){

					////console.log('ON RAN');
					////console.log(message);

					listenerclient.off(currentListenerId, function(e){

						if (e)
							return callback(new Error(e));
						else
							return callback();

					});

				}, 
				function(e, listenerId){
					if (e) return callback(new Error(e));

					currentListenerId = listenerId;

					publisherclient.set('/e2e_test1/testsubscribe/data/on_off_test', {property1:'property1',property2:'property2',property3:'property3'}, {}, function(e, setresult){
						if (e) return callback(new Error(e));

						////console.log('DID ON SET');
						////console.log(setresult);
					});

				});
				
			});

		}, function(e, listenerId){
			if (e) return callback(new Error(e));

			currentListenerId = listenerId;

			publisherclient.set('/e2e_test1/testsubscribe/data/on_off_test', {property1:'property1',property2:'property2',property3:'property3'}, {}, function(e, setresult){
				if (e) return callback(new Error(e));
			});
		});
	});

	
	var caughtCount = 0;
	it('should subscribe to the catch all notification', function(callback) {

		var caught = {};

		this.timeout(10000);
		
		listenerclient.onAll(function(eventData){

			if (eventData.action == '/REMOVE@/e2e_test1/testsubscribe/data/catch_all_array' || 
	          	eventData.action == '/REMOVE@/e2e_test1/testsubscribe/data/catch_all' || 
	          	eventData.action == '/SET@/e2e_test1/testsubscribe/data/catch_all_array' || 
	          	eventData.action == '/SET@/e2e_test1/testsubscribe/data/catch_all')
	        caughtCount++;

	      	if (caughtCount == 4)
	        	callback();


		}, function(e){

			////console.log('on all ok?');
			////console.log(e);

			if (e) return callback(e);
			

			publisherclient.set('/e2e_test1/testsubscribe/data/catch_all', {property1:'property1',property2:'property2',property3:'property3'}, null, function(e, put_result){

				////////////////////////console.log('put_result');
				////////////////////////console.log(put_result);

				publisherclient.setChild('/e2e_test1/testsubscribe/data/catch_all_array', {property1:'property1',property2:'property2',property3:'property3'}, function(e, post_result){

					////////////////////////console.log('post_result');
					////////////////////////console.log(post_result);

					publisherclient.remove('/e2e_test1/testsubscribe/data/catch_all', null, function(e, del_result){

						////////////////////////console.log('del_result');
						////////////////////////console.log(del_result);

						publisherclient.removeChild('/e2e_test1/testsubscribe/data/catch_all_array', post_result.payload._id, function(e, del_ar_result){

							////////////////////////console.log('del_ar_result');
							////////////////////////console.log(del_ar_result);
					
						});
				
					});
				
				});

			});

		});

	});

	it('should unsubscribe from all events', function(callback) {
		this.timeout(10000);

		var onHappened = false;

		listenerclient.onAll(function(message){

			onHappened = true;
			callback(new Error('this wasnt meant to happen'));

		}, function(e){

			if (e) return callback(e);
			
			listenerclient.on('/e2e_test1/testsubscribe/data/off_all_test', {event_type:'set', count:0}, 
				function(message){
					onHappened = true;
					callback(new Error('this wasnt meant to happen'));
				}, 
				function(e){
					if (e) return callback(e);

					listenerclient.offAll(function(e){
						if (e) return callback(e);

						publisherclient.set('/e2e_test1/testsubscribe/data/off_all_test', {property1:'property1',property2:'property2',property3:'property3'}, null, function(e, put_result){
							if (e) return callback(e);

							setTimeout(function(){

								if (!onHappened)
									callback();

							}, 2000);
						});
					});
				}
			);
		});
	});

	/*

	it('should fail to subscribe to an event', function(callback) {

		this.timeout(default_timeout);
		subWasSuccessful = true;

		var badclient = new happn.client({config:{host:'localhost', port:testport, secret:test_secret}}, function(e){
    	if (e) return callback(e);

			badclient.session.token = 'rubbish'; //we put in a rubbish token
			badclient.onAll(function(message){

				//////console.log('badclient on all happened');
				//////console.log(arguments);

			}, function(e){

				//console.log('fail to sub e');
				//console.log(e);

				if (e && e == 'Authentication failed: Error: Not enough or too many segments'){
					callback();
				}
				else callback('unauthorized subscribe was let through');

			});

		});

	});	

*/

});