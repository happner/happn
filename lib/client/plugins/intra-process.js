module.exports = {
	initialize:function(config, done){
		var _this = this;

		try{

			_this.config = config;
			_this.dataService = _this.context.services.data;
			_this.pubsub = _this.context.services.pubsub;

			_this.token = _this.pubsub.connect(_this.handle_publication.bind(_this));

			done();

		}catch(e){
			done(e);
		}
	},
	performRequest:function(path, action, data, parameters, handler){
		
		var _this = this;

		if (!parameters)
			parameters = {};

		var message = {"path":path, "action":action, "eventId":_this.getEventId(), "parameters":parameters, "token":_this.token};

		var eventSourceProxy =  {
			write:function(response){
				if (handler){
					if (response.status == 'error') return handler(response);
					return handler(null, response);
				}else{
					if (response.status == 'error')
						_this.handle_error(response);
				}
			}
		}

		if (action == "set"){
			if (parameters && parameters.noStore) return _this.pubsub.handleDataResponse(null, message, _this.dataService.transformSetData(path, data), eventSourceProxy);
           
			_this.dataService.upsert(path, data, parameters, function(e, response){
				return _this.pubsub.handleDataResponse(e, message, response, eventSourceProxy);
			});

		}else if (action == "get"){

			_this.dataService.get(path, parameters, function(e, response){
				_this.pubsub.handleDataResponse(e, message, response, eventSourceProxy);
			});

		}else if (action == "remove"){

			_this.dataService.remove(path, parameters, function(e, response){
				return _this.pubsub.handleDataResponse(e, message, response, eventSourceProxy);
			});

		}else{
			var error = new Error("Invalid action: " + action);

			if (handler)
				return handler(error);
			else
				_this.handle_error(error);
		}
			
	},
	set:function(path, data, parameters, handler){
		var _this = this;
		setImmediate(function(){
			_this.setInternal(path, data, parameters, handler);
		});
	},
	setInternal:function(path, data, parameters, handler){
		this.performRequest(path, "set", data, parameters, handler);
	},
	_remoteOff:function(channel, decrementBy, done){
		var _this = this;
		try{
			//console.log(arguments);
			_this.pubsub.removeListener(_this.token, channel, decrementBy);
			//console.log('calling done');
			//console.log(done.toString());
			done();
		}catch(e){
			//console.log('failed removing listener');

			//console.log(e);
			done(e);
		}
	},
	offAll:function(done){
		var _this = this;

		try{
			_this.pubsub.removeListener(_this.token, '*');
			_this.events = {};
			done();
		}catch(e){
			done(e);
		}
	},
	on:function(path, parameters, handler, done){
		var _this = this;

		if (!parameters) parameters = {};
		if (!parameters.event_type) parameters.event_type = 'all';
		if (!parameters.count) parameters.count = 0;
		//if (!parameters.count) parameters.count = 0;
		var listenerId = _this.currentListenerId++;

		try{
			var channel = _this.getChannel(path, parameters.event_type);

			_this.pubsub.addListener(channel, _this.token);

			if (!_this.events[channel])
				_this.events[channel] = [];

			_this.events[channel].push({handler:handler, count:parameters.count, id:listenerId, runcount:0});

			done(null, listenerId);

		}catch(e){
			done(e);
		}
	}
}