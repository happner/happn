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

			this.dataService = this.context.services.data;
			this.securityService = this.context.services.security.safe();
			this.pubsub = this.context.services.pubsub;

			var _this = this;

			if (!_this.options.config.deferSetImmediate){
				_this.setImmediate = setImmediate;
				_this.options.config.deferSetImmediate = 0;
			}

			if (_this.context.config.secure && !_this.options.secure){
				return done(_this.securityService.AccessDeniedError('attempt to log on to a secure server'));
			}
				
			if (!_this.options.secure){

				_this.authorizeRequest = function(message, handler, callback){
					callback();
				}

				_this.__login = function(message, data, handler){
					_this.session = _this.pubsub.connectLocal(_this.handle_publication.bind(_this), _this.securityService.generateEmptySession());
					return _this.pubsub.handleDataResponseLocal(null, message, _this.session, handler, _this);
				}
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

	authenticate:Promise.promisify(function(done){
		this.__connecting = true;
		this.login(function(e){
			this.__connecting = false;
				done(e);
		});
	}),

	validateRequest:function(path, action, data, parameters, handler){

		if (['login','set','get','remove'].indexOf(action) == -1){
			var error = new Error("invalid action: " + action);

			if (handler)
				return handler(error);
			else
				return this.handle_error(error);
		}

		
	},

	authorizeRequest:function(message, handler, callback){

		if (this.pubsub.trusted[this.session.id] == undefined) return this.pubsub.handleDataResponseLocal(this.securityService.AccessDeniedError('unauthorized'), message, null, handler, this);

		var _this = this;

		_this.securityService.authorize(_this.session, message.path, message.action, function(e, allowed){

			if (e) return _this.pubsub.handleDataResponseLocal(e, message, null, handler, _this);

			if (!allowed) return _this.pubsub.handleDataResponseLocal(_this.securityService.AccessDeniedError('unauthorized'), message, null, handler, _this);

			callback();

		});

	},

	__login:function(message, data, handler){
		var _this = this;
		return _this.securityService.login(data, function(e, session){

			if (e) return _this.pubsub.handleDataResponseLocal(e, message, null, handler, _this);

			_this.session = _this.pubsub.connectLocal(_this.handle_publication.bind(_this), session);

			return _this.pubsub.handleDataResponseLocal(null, message, _this.session, handler, _this);

		});
	},

	performRequest:function(path, action, data, parameters, handler) {

		var _this = this;

		if (!parameters)
			parameters = {};

		_this.validateRequest(path, action, data, parameters, handler);

		var message = {"path":path, "action":action, "eventId":_this.getEventId(), "parameters":parameters};

		if (action == "login"){
			return _this.__login(message, data, handler);
		}
	
		_this.authorizeRequest(message, handler, function(){

			if (action == "set"){
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
			}

		});
	},
	disconnect:Promise.promisify(function(done){
		
		var _this = this;
		_this.offAll(function(e){

			if (e)
				console.warn('failed ending subscriptions on disconnect', e);

			_this.initialized = false;
			_this.session = null;

			done();

		});
	}),
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
		
		var _this = this;

		_this.authorizeRequest({path:path, action:'on'}, done, function(){

			var listenerId = _this.currentListenerId++;

			try{
				var channel = _this.getChannel(path, parameters.event_type);
				_this.pubsub.addListener(channel, _this.session.index, {refCount:1});

				if (!_this.events[channel])
					_this.events[channel] = [];

				_this.events[channel].push({handler:handler, count:parameters.count, id:listenerId, runcount:0});
				done(null, listenerId);

			}catch(e){
				done(e);
			}
		});
	})
}