var JSONStream = require('JSONStream');

module.exports = {
	publish:function(req, done){

		var _this = this;

		var message = {payload:req.result, path:'/' + req.message.action + '@' + req.message.path, action:req.message.action, params:req.message.params};

		_this.happn.services.pubsub.publish(message);
		//_this.happn.services.eventemitter.publish(message);

		done();
	},
	respond:function(req, res, err){

		var status = 'ok';
		var _this = this;

		if (err){
			status = 'error';
			req.result = err;
		}

		res.writeHead(200, {"Content-Type":"application/json",
							"Charset":"utf-8",
 						  	"Access-Control-Allow-Origin": "*",
 						  	"Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, session_token",
 						  	"Access-Control-Allow-Methods": "GET,PUT,DELETE,POST"});

		if (!err){

			if (['PUT','DELETE'].indexOf(req.method) > -1){

				if (req.message.options && req.message.options.noPublish)
					return res.end(JSON.stringify({status:status, payload:req.result, published:false}));
				else
					_this.publish(req, function(e){
					
						var published_status = 'ok';

						if (e)
							published_status = e;

						res.end(JSON.stringify({status:status, payload:req.result, published:published_status}));

					});

			}else if (['POST','GET'].indexOf(req.method) > -1){

				if (req.message.path != '/auth')
					_this.streamResults(req, res, status, false);
				else
					res.end(JSON.stringify({status:status, payload:req.result, published:false}));
			}
			
		}else{
			res.end(JSON.stringify({status:status, payload:req.result, published:false}));
		}
			
	},
	streamResults:function(req, res, status, published){

		try{

			if (status == 'ok' && req.result){
				
				res.write('{"status":"ok", "published":"' + published.toString() + '", "payload":[');

				var length = 0;

				////////////////console.log('Streaming results');
				////////////////console.log(req.result.length)

				var streamItem = function(item, index){
					////////////////console.log('Streaming result');
					////////////////console.log(item);
				
		 			var chunck = JSON.stringify(item);	

		 			if (index > 0)
		 				chunck = ',' + chunck;
		 			
		 			res.write(chunck);
				}

				//EMBEDDED DIFFERENCE
				if (Array.isArray(req.result)){
					req.result.map(function(item, index){
						streamItem(item, index);
					});

					res.end("]}");
				}else{
					var streamed = 0;
					//we are dealing with a cursor
					req.result.each(function(e, item) {
					 	//////////////////console.log('in next obj');
					 	//////////////////console.log(item);

					 	if (e)
					 		return res.end('BROKEN PIPE: ' + e);

					 	if (!item)
					 		res.end("]}");

					 	streamItem(item, streamed);
					 	streamed++;
				 	});
				}

				////////////////console.log("AT END");

				
			}
			else
				res.end(JSON.stringify({status:status, payload:req.result, published:false}));


		}catch(e){
			res.end(JSON.stringify({status:'error', payload:e.toString(), published:false}));
		}

	},
	process:function(req, res, next){

		////////////////////console.log('RESPOND MIDDLEWARE');
		this.respond(req, res, null);
	},
	process_error:function(err, req, res, next){

		////////////////////console.log('RESPOND MIDDLEWARE');
		this.respond(req, res, err);
	}
}