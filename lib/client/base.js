(function() { // begin enclosed

var browser = false;

if (typeof window !== 'undefined' && typeof document !== 'undefined') browser = true;

if (!browser) {
	module.exports = HappnClient;
	Promise = require('bluebird');
} else {
	window.HappnClient = HappnClient;
	if (!Promise || typeof Promise.promisify !== 'function') {
		Promise = Promise || {};
		Promise.promisify = function(fn) {return fn};
	}
}

function HappnClient() {
  this.initialized = false;
 	this.events = {};
	this.messageEvents = {};
	this.requestEvents = {};
	this.currentEventId = 0;
	this.currentListenerId = 0;
	this.errors = [];
	this.immediateTicks = 0;
}

HappnClient.create = Promise.promisify(function(options, done){

	if (typeof options == 'function'){
		done = options;
		options = {};
	}
		
	var clientInstance = new HappnClient();
	clientInstance.client(options).initialize(done);
});

HappnClient.prototype.client = function(options){
	var _this = this;
		// var credentials;
		options = options || {};

	if (options.Logger && options.Logger.createLogger) {
		this.log = options.Logger.createLogger('HappnClient');
	} else {
		this.log = {
		  $$TRACE: function() {},
		  $$DEBUG: function() {},
		  info: function(msg, obj) {
		    if (obj) return console.info('HappnClient', msg, obj);
		    console.info('HappnClient', msg);
		  },
		  warn: function(msg, obj) {
		    if (obj) return console.warn('HappnClient', msg, obj);
		    console.info('HappnClient', msg);
		  },
		  error: function(msg, obj) {
		    if (obj) return console.error('HappnClient', msg, obj);
		    console.info('HappnClient', msg);
		  }
		}
	}

	if (!options.config)
		options.config = {};

	if (!options.config.host)
		options.config.host = '127.0.0.1';

	if (!options.config.port)
		options.config.port = 55000;

	if (!options.config.pubsub)
		options.config.pubsub = {};

	if (!options.config.pubsub.options)
		options.config.pubsub.options = {};

	if (!options.info)
		options.info = {};

	options.info._browser = browser;

	if (options.context)
		_this.context = options.context;

	if (options.plugin){
		for (var overrideName in options.plugin){
			if (options.plugin.hasOwnProperty(overrideName)){
				if (options.plugin[overrideName].bind)
					_this[overrideName] = options.plugin[overrideName].bind(_this);
				else
					_this[overrideName] = options.plugin[overrideName];
			}
		}		
	}

	if (!options.config.url) {
		options.config.protocol = options.config.protocol || 'http';
		if (options.config.protocol == 'http' && parseInt(options.config.port) == 80) {
			options.config.url = options.config.protocol + '://' + options.config.host;
		} 
		else if (options.config.protocol == 'https' && parseInt(options.config.port) == 443) {
			options.config.url = options.config.protocol + '://' + options.config.host;
		} else {
			options.config.url = options.config.protocol + '://' + options.config.host + ':' + options.config.port;
		}
	}

	_this.options = options;
	return _this;
};

HappnClient.prototype.setImmediate = function(func, mod){
	this.immediateTicks++;
	if (this.immediateTicks % mod == 0){
		setImmediate(func);
	}else
		func.call();
};

HappnClient.prototype.getScript = function(url, callback) {
	if (!browser) return callback(new Error('only for browser'));
	var script=document.createElement('script');
  script.src=url;
  var head=document.getElementsByTagName('head')[0];
  var done=false;
  // Attach handlers for all browsers
  script.onload=script.onreadystatechange = function(){
     if ( !done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete') ) {
      done=true;
      callback();
      script.onload = script.onreadystatechange = null;
      head.removeChild(script);
    }
  };
  head.appendChild(script);
}

HappnClient.prototype.initialize = Promise.promisify(function(done){

	var _this = this;

	if (browser && typeof Primus == 'undefined') {
		return this.getScript(_this.options.config.url + '/browser_primus.js', function(e) {

			if (e) return done(e);

			_this.authenticate(function(e){
				if (e) return done(e);

				_this.initialized = true;
				done(null, _this);
			});
		});
	}

	_this.authenticate(function(e){
		if (e) return done(e);

		_this.initialized = true;
		done(null, _this);
	});
});


HappnClient.prototype.stop = Promise.promisify(function(done) {
	this.pubsub.on('end', done);
	this.pubsub.end();
});


HappnClient.prototype.__connecting = false;

HappnClient.prototype.login = Promise.promisify(function(done){

	var _this = this;

	return _this.performRequest(null, 'login', {
		username: this.options.config.username,
		password: this.options.config.password,
		info: this.options.info
	}, null, function(e, result){

		if (e)
			return done(e); // TODO: ensure it's instanceof Error

		if (result._meta.status == 'ok') {
			
			delete result._meta;
			_this.session = result;

			done();
		}else{
			done(result.payload); // TODO: make into instanceof Error
		}
			

	});
});

HappnClient.prototype.authenticate = Promise.promisify(function(done){
	var _this = this;

	if (this.pubsub) {
		// handle_reconnection also call through here to "re-authenticate".
		// This is that happending. Don't make new soket.
		//
		// TODO: What happnes if this reconnection login fails?
		//       Who gets told?
		//       How?
		this.login(done);
		return;
	}
	
	if (browser) {
			this.__connecting = true;
			this.pubsub = Primus.connect(this.options.config.url, this.options.config.pubsub.options);
			this.pubsub.on('open', function() {
				this.__connecting = false;
			});
			this.pubsub.on('error',  function(e) {
				if (_this.__connecting) {
					// ERROR before connected, 
					// ECONNREFUSED etc. out as errors on callback
					_this.__connecting = false;
					return done(e);
				}
				_this.handle_error(e);
			});
			this.pubsub.on('data', this.handle_publication.bind(this));
			this.pubsub.on('reconnected', this.handle_reconnection.bind(this));
	}
	else {
		this.__connecting = true;
		Primus = require('primus'), 
		Socket = Primus.createSocket({ "transformer": this.options.config.transformer, "parser": this.options.config.parser, "manual":true });

		this.pubsub = new Socket(this.options.config.url);
		this.pubsub.on('open', function() {
			_this.__connecting = false;
		});
		this.pubsub.on('error',  function(e) {
			if (_this.__connecting) {
				_this.__connecting = false;
				return done(e);
			}
			_this.handle_error(e);
		});
		this.pubsub.on('data', this.handle_publication.bind(this));
		this.pubsub.on('reconnected', this.handle_reconnection.bind(this));
	}

	// login is called before socket connection established...
	// seems ok (streams must be paused till open)
	this.login(done);
	
});

HappnClient.prototype.getEventId = function(){
	return this.currentEventId += 1;
};

HappnClient.prototype.performRequest = function(path, action, data, parameters, done){

	if (!this.initialized && action != 'login') return done('client not initialized yet.');

	if (!parameters) parameters = {};

	var message = {"path":path, "action":action, "eventId":this.getEventId(), "parameters":parameters, "data":data};
	
	if (!parameters.timeout)
		parameters.timeout = 20000;

	if (done){//if null we are firing and forgetting

		var callbackHandler = {
			"eventId":message.eventId,
			"client":this,
			"handler":done
		};

		callbackHandler.handleResponse = function(e, response){
			clearTimeout(this.timedout);
			return this.handler(e, response);
		}.bind(callbackHandler);

		callbackHandler.timedout = setTimeout(function(){
			delete this.client.requestEvents[this.eventId];

			var errorMessage = "api request timed out";

			if (path)
				errorMessage += " path: " + path;

			if (action)
				errorMessage += " action: " + action;

			return this.handler(new Error(errorMessage));

		}.bind(callbackHandler),parameters.timeout);

		//we add our event handler to a queue, with the embedded timeout
		this.requestEvents[message.eventId] = callbackHandler;
	}

	this.pubsub.write(message);
};

HappnClient.prototype.checkPath = function(path){
	if (path.match(/^[a-zA-Z0-9@.//_*/-]+$/) == null)
		throw 'Bad path, can only contain alphanumeric characters, forward slashes, underscores @ and minus signs, and the * wildcard character ie: /this/is/an/example/of/1/with/an/_*-12hello';
};

// HappnClient.prototype.getURL = function(path, parameters){

// 	this.checkPath(path);

// 	if (path.substring(0,1) != '/')
// 		path = '/' + path; 

// 	var api_url = this.options.config.url + path;

// 	if (parameters)
// 		if (browser) {
// 			api_url += "?parameters=" + btoa(JSON.stringify(parameters));
// 		} else {
// 			api_url += "?parameters=" + new Buffer(JSON.stringify(parameters)).toString('base64');
// 		}
// 	return api_url;
	
// };

HappnClient.prototype.getChannel = function(path, action){
	this.checkPath(path);

	return '/' + action.toUpperCase() + '@' + path;
};

HappnClient.prototype.get = Promise.promisify(function(path, parameters, handler){
	if (typeof parameters == 'function') {
		handler = parameters;
		parameters = {};
	}
	this.performRequest(path, 'get', null, parameters, handler);
});

HappnClient.prototype.getPaths = Promise.promisify(function(path, handler){
	this.get(path, {options:{path_only:true}}, handler);
});

HappnClient.prototype.set = Promise.promisify(function(path, data, parameters, handler){
	if (typeof parameters == 'function') {
		handler = parameters;
		parameters = {};
	}
	this.performRequest(path, 'set', data, parameters, handler);
});

HappnClient.prototype.setSibling = Promise.promisify(function(path, data, handler){
	this.set(path, data, {set_type:'sibling'}, handler);
});

HappnClient.prototype.remove = Promise.promisify(function(path, parameters, handler){
	//path, action, data, parameters, done
	if (typeof parameters == 'function') {
		handler = parameters;
		parameters = {};
	}
	return this.performRequest(path, 'remove', null, parameters, handler);
});

HappnClient.prototype.handle_reconnection = function(options){

	var _this = this;
	_this.authenticate(function(e){

		if (e) return _this.handle_error(e, 3);

		Object.keys(_this.events).forEach(function(eventPath) {
			var listeners = _this.events[eventPath];
			_this._remoteOn(eventPath, listeners.length, function(e) {
				if (e) _this.handle_error(e, 3);
			});
		});
	});
}

HappnClient.prototype.handle_error = function(err, severity){

	if (!severity)
		severity = 1;

	if (this.errors.length >= 100)
		this.errors.splice(err, this.errors.length - 1, 1)
	else
		this.errors.push(err);
	
	this.log.error('unhandled error', err);

};

HappnClient.prototype.decodeArrayResponse = function(message) {

	var decoded = message.map(function(item) {
		var obj = item.data;
		obj._meta = item._meta;
		// Object.defineProperty(obj, '_store', {
		// 	value: item._store,
		// 	enumerable: false
		// });
		// obj._store = item._store;
		if (item._id) {
			// obj._store.path = item.path;
			obj._meta.id = item._id;
		}
		return obj;
	});
	// Object.defineProperty(decoded, '_event', {
	// 	value: message._event,
	// 	enumerable: message._event.status == 'error'
	// });
	decoded._meta = message._meta;
	return decoded;
}

HappnClient.prototype.handle_publication = function(message){

	if (message._meta && message._meta.type == 'system')
	  return this.__handleSystemMessage(message);

	if (message._meta && message._meta.type == 'data')
	  return this.handle_data(message._meta.channel, message);
  	
	if ( Array.isArray(message) ) {
	    message._meta = message.pop();
	    this.handle_response(null, message);
	}

	else if (message._meta.status == 'error') {

		var error = message._meta.error;

		var e = new Error();
		e.name = error.name || error.message || error;

		Object.keys(error).forEach(function(key) {
			if (!e[key])
				e[key] = error[key];
		});

		this.handle_response(e, message);

	}

	else {

		var decoded = message.data;
		decoded._meta = message._meta;
		this.handle_response(null, decoded);

	}

};

HappnClient.prototype.handle_response = function(e, response){

	var responseHandler = this.requestEvents[response._meta.eventId];

	if (responseHandler)
		responseHandler.handleResponse(e, response);
		
};

HappnClient.prototype.handle_message = function(message){
	if (this.messageEvents[message.messageType] && this.messageEvents[message.messageType].length > 0){
		this.messageEvents[message.messageType].map(function(delegate, index, arr){
			delegate.handler.call(this, message);
		});
	}
};

HappnClient.prototype.handle_data = function(path, message){

	var _this = this;

	if (_this.events[path]){
		var toDetach = [];
		_this.events[path].map(function(delegate, delegateIndex){
			
			delegate.runcount++;
			if (delegate.count > 0 && delegate.count == delegate.runcount){
				_this._offListener(delegate.id, function(e){
					if (e)
						return _this.handle_error(e);
					delegate.handler.call(_this, message.data, message._meta);
				});
			}else {
				delegate.handler.call(_this, message.data, message._meta);
			}
		});
	};
};

HappnClient.prototype.__systemMessageHandlers = [];

HappnClient.prototype.__handleSystemMessage = function(message){

	this.__systemMessageHandlers.every(function(messageHandler){
		return messageHandler.apply(messageHandler, [message.eventKey, message.data]);
	});
}

HappnClient.prototype.offSystemMessage = function(index){
	this.__systemMessageHandlers.splice(index, 1);
};

HappnClient.prototype.onSystemMessage = function(handler){
	this.__systemMessageHandlers.push(handler);
	return this.__systemMessageHandlers.length - 1;
};

HappnClient.prototype._remoteOn = function(path, refCount, done){
	this.performRequest(path, 'on', this.session, {"refCount":refCount}, done);
}

HappnClient.prototype.on = Promise.promisify(function(path, parameters, handler, done){

	var _this = this;

	if (typeof parameters == 'function') {
		done = handler;
		handler = parameters;
		parameters = {};
	}

	if (!parameters) parameters = {};
	if (!parameters.event_type) parameters.event_type = 'all';
	if (!parameters.count) parameters.count = 0;
	
	path = _this.getChannel(path, parameters.event_type);

	var listenerId = _this.currentListenerId++;

	_this._remoteOn(path, listenerId, function(e, response){
		
		if (e)
			return done(e);

		if (response.status == 'error')
			return done(response.payload);

		if (!_this.events[path])
			_this.events[path] = [];

		var listener = {handler:handler, count:parameters.count, id:listenerId, runcount:0};
		_this.events[path].push(listener);

		done(null, listenerId);
	});
});

HappnClient.prototype.onAll = Promise.promisify(function(handler, done){
	this.on('*', null, handler, done);
});

HappnClient.prototype._remoteOff = function(channel, refCount, done){
	this.performRequest(channel, 'off', this.session, {"refCount":refCount}, function(e, response){
		if (e)
			return done(e);

		if (response.status == 'error')
			return done(response.payload);

		done();
	});
};

HappnClient.prototype._offListener = function(listenerId, done){
	var _this = this;

	for (var channel in _this.events){
		var listeners = _this.events[channel];

		if (!listeners)
			return done();

		listeners.every(function(listener, listenerIndex){
			if (listener.id == listenerId){
				_this._remoteOff(channel, 1, function(e){
					if (e)
						return done(e);
					listeners.splice(listenerIndex, 1);
					done();
				});
				return false;
			} else return true;
		});
	}
};

HappnClient.prototype._offPath = function(path, done){
	var _this = this;

	var listenersFound = false;
	for (var channel in _this.events){

		var channelParts = channel.split('@');
		var channelPath = channelParts.slice(1, channelParts.length).join('@');

		if (channelPath == path){
			listenersFound = true;
			return _this._remoteOff(channel, _this.events[channel].length, function(e){

				if (e)
					return done(e);

				delete _this.events[channel];
				done();
			});
		}
	}

	if (!listenersFound)
		done();
}

HappnClient.prototype.offAll = Promise.promisify(function(done){
	var _this = this;

	return _this._remoteOff('*', 0, function(e){
		if (e)
			return done(e);

		_this.events = {};
		done();
	});
});

HappnClient.prototype.off = Promise.promisify(function(listenerRef, done){

	if (!listenerRef)
		return done(new Error('listenerRef cannot be null'));

	if (typeof listenerRef == "number")
		return this._offListener(listenerRef, done);
	
	return this._offPath(listenerRef, done);
});


})(); // end enclosed

