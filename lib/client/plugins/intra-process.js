module.exports = {
	nonDeferred:0,
	setImmediate:function(func, deferOn){
		this.nonDeferred++;
		if (this.nonDeferred == deferOn){
			this.nonDeferred = 0;
			setImmediate(func);
		}else
			func.call();
	},
	initialize:function(done){
		try{

			this.dataService = this.context.services.data;
			this.pubsub = this.context.services.pubsub;

			this.session = this.pubsub.connect(this.handle_publication.bind(this));

			if (!this.options.config.deferSetImmediate){
				this.setImmediate = setImmediate;
				this.options.config.deferSetImmediate = 0;
			}
				
			done();

		}catch(e){
			done(e);
		}
	},

	performRequest:function(path, action, data, parameters, handler){
		
		var _this = this;

		if (!parameters)
			parameters = {};

		var message = {"path":path, "action":action, "eventId":_this.getEventId(), "parameters":parameters};

		if (action == "set"){
			if (parameters.noStore) return _this.pubsub.handleDataResponseLocal(null, message, _this.dataService.transformSetData(path, data), handler, _this);
           
			_this.dataService.upsert(path, data, parameters, function(e, response){
				return _this.pubsub.handleDataResponseLocal(e, message, response, handler, _this);
			});

		}else if (action == "get"){
			_this.dataService.get(path, parameters, function(e, response){
				_this.pubsub.handleDataResponseLocal(e, message, response, handler, _this);
			});

		}else if (action == "remove"){

			_this.dataService.remove(path, parameters, function(e, response){
				return _this.pubsub.handleDataResponseLocal(e, message, response, handler, _this);
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
		_this.setImmediate(function(){
			_this.setInternal(path, data, parameters, handler);
		}, _this.options.config.deferSetImmediate);
	},
	setInternal:function(path, data, parameters, handler){
		this.performRequest(path, "set", data, parameters, handler);
	},
	_remoteOff:function(channel, refCount, done){
		try{
			this.pubsub.removeListener(this.session.index, channel, {"refCount":refCount});
			done();
		}catch(e){
			done(e);
		}
	},
	offAll:function(done){
		try{
			this.pubsub.removeListener(this.session.index, '*');
			this.events = {};
			done();
		}catch(e){
			done(e);
		}
	},
	on:function(path, parameters, handler, done){

		if (!parameters) parameters = {};
		if (!parameters.event_type) parameters.event_type = 'all';
		if (!parameters.count) parameters.count = 0;
		
		var listenerId = this.currentListenerId++;

		try{
			var channel = this.getChannel(path, parameters.event_type);

			this.pubsub.addListener(channel, this.session.index, {refCount:1});

			if (!this.events[channel])
				this.events[channel] = [];

			this.events[channel].push({handler:handler, count:parameters.count, id:listenerId, runcount:0});

			done(null, listenerId);

		}catch(e){
			done(e);
		}
	}
}