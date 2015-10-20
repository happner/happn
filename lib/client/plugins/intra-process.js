var Promise = require('bluebird');

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

	initialize:Promise.promisify(function(done){
		try{

			console.log('INIT INTRA-PROC');

			this.dataService = this.context.services.data;
			this.securityService = this.context.services.security.safe();
			this.pubsub = this.context.services.pubsub;

			var _this = this;

			if (!this.options.config.deferSetImmediate){
				this.setImmediate = setImmediate;
				this.options.config.deferSetImmediate = 0;
			}

			_this.authenticate(function(e){
				if (e) return done(e);

				_this.initialized = true;
				done(null, _this);
			});	

		}catch(e){
			done(e);
		}
	}),

	performRequest:function(path, action, data, parameters, handler) {

		var _this = this;

		if (!parameters)
			parameters = {};

		var message = {"path":path, "action":action, "eventId":_this.getEventId(), "parameters":parameters};

		if (action == "login"){
			
			_this.securityService.login(data, function(e, session){

				if (e) return _this.pubsub.handleDataResponseLocal(e, message, null, handler, _this);
				
				_this.session = _this.pubsub.connectLocal(_this.handle_publication.bind(_this), session);
				return _this.pubsub.handleDataResponseLocal(null, message, _this.session, handler, _this);

			});

		}else if (action == "set"){
			if (parameters.noStore) return _this.pubsub.handleDataResponseLocal(null, message, _this.dataService.formatSetData(path, data), handler, _this);
           
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
	
	set: Promise.promisify(function(path, data, parameters, handler){
		var _this = this;
		if (typeof parameters == 'function') {
			handler = parameters;
			parameters = {};
		}

		_this.setImmediate(function(){
			_this.setInternal(path, data, parameters, handler);
		}, _this.options.config.deferSetImmediate);
	}),
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
	offAll:Promise.promisify(function(done){
		try{
			this.pubsub.removeListener(this.session.index, '*');
			this.events = {};
			done();
		}catch(e){
			done(e);
		}
	}),
	on: Promise.promisify(function(path, parameters, handler, done){

		if (typeof parameters == 'function') {
			done = handler;
			handler = parameters;
			parameters = {};
		}

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
	})
}