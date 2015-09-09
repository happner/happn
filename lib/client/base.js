(function() { // begin enclosed

var browser = false;

if (typeof window !== 'undefined' && typeof document !== 'undefined') browser = true;

if (!browser) {
	module.exports = HappnClient;
} else {
	window.HappnClient = HappnClient;
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

HappnClient.create = function(options, done){
	var clientInstance = new HappnClient();
	clientInstance.client(options, done);
}

HappnClient.prototype.client = function(options, done){
	var _this = this;

	options = options || {};

	if (options.Logger) {
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

	_this.initialized = false;
	_this.events = {};
	_this.messageEvents = {};
	_this.requestEvents = {};
	_this.currentEventId = 0;
	_this.currentListenerId = 0;
	_this.errors = [];

	if (!options.config)
		options.config = {};

	if (!options.config.host)
		options.config.host = '127.0.0.1';

	if (!options.config.port)
		options.config.port = 55000;

	if (!options.config.secret)
		options.config.secret = 'happn';

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

	if (!options.config.url)
		options.config.url = 'http://' + options.config.host + ':' + options.config.port;

	_this.options = options;

	_this.initialize(function(e){
		if (e) return done(e);

		done(null, _this);
	});
}

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

HappnClient.prototype.initialize = function(done){

	var _this = this;

	if (browser && typeof Primus == 'undefined') {
		this.getScript(_this.options.config.url + '/browser_primus.js', function(e) {

			// ONLY BROWSER ! and only if no primus

			_this.authenticate(function(e){

				if (e)
					return done(e);

				_this.initialized = true;
				done();
			});
		});
		return;
	}

	// BOTH BROWSER AND SERVER 
	// if the primus script has already loaded 
	// before this initialize() function

	this.authenticate(function(e){

		if (e)
			return done(e);

		_this.initialized = true;
		done();
	});
};

HappnClient.prototype.authenticate = function(done){
	var _this = this;

	if (browser) {
		if (!this.pubsub) {
			this.pubsub = Primus.connect(this.options.config.url, this.options.config.pubsub.options);
			this.pubsub.on('error',  this.handle_error.bind(this));
			this.pubsub.on('data', this.handle_publication.bind(this));
			this.pubsub.on('reconnected', this.handle_reconnection.bind(this));
		}
	}
	else {
		if (!this.pubsub) {
			Primus = require('primus'), 
			Socket = Primus.createSocket({ "transformer": this.options.config.transformer, "parser": this.options.config.parser, "manual":true });

			this.pubsub = new Socket(this.options.config.url);
			this.pubsub.on('error',  this.handle_error.bind(this));
			this.pubsub.on('data', this.handle_publication.bind(this));
			this.pubsub.on('reconnected', this.handle_reconnection.bind(this));
		}
	}

	return this.performRequest(null, 'login', {
		secret: this.options.config.secret,
		info: this.options.info
	}, null, function(e, result){

		if (e)
			return done(e);

		if (result.status == 'ok'){
			_this.session = result.payload;
			done();
		}else
			done(result.payload);

	});
};

/*
HappnClient.prototype.parseJSON = function(b){
	try
	{
		if (typeof(b) == 'object')

			if (b != null && b != undefined)
			{
				return JSON.parse(b);
			}
			else 
				throw new Error('b is null');
		}

	}
	catch(e)
	{
		throw new Error(e);
	}
};
*/

HappnClient.prototype.getEventId = function(){
	return this.currentEventId += 1;
};

HappnClient.prototype.performRequest = function(path, action, data, parameters, done){

	if (!this.initialized && action != 'login') return done('Client not initialized yet.');

	if (!parameters) parameters = {};

	var message = {"path":path, "action":action, "eventId":this.getEventId(), "parameters":parameters, "data":data};
	
	if (!parameters.timeout)
		parameters.timeout = 10000;

	if (done){//if null we are firing and forgetting

		var callbackHandler = {
			"eventId":message.eventId,
			"client":this,
			"handler":done
		};

		callbackHandler.handleResponse = function(response){
			clearTimeout(this.timedout);
			return this.handler(null, response);
		}.bind(callbackHandler);

		callbackHandler.timedout = setTimeout(function(){
			delete this.client.requestEvents[this.eventId];
			return this.handler("Request timed out");
		}.bind(callbackHandler),parameters.timeout);

		//we add our event handler to a queue, with the embedded timeout
		this.requestEvents[message.eventId] = callbackHandler;
	}

	this.pubsub.write(message);
};

HappnClient.prototype.checkPath = function(path){
	if (path.match(/^[a-zA-Z0-9//_*/-]+$/) == null)
		throw 'Bad path, can only contain alphanumeric chracters, forward slashes, underscores, a single wildcard * and minus signs ie: /this/is/an/example/of/1/with/an/_*-12hello';
};

HappnClient.prototype.getURL = function(path, parameters){

	this.checkPath(path);

	if (path.substring(0,1) != '/')
		path = '/' + path; 

	var api_url = this.options.config.url + path;

	if (parameters)
		if (browser) {
			api_url += "?parameters=" + btoa(JSON.stringify(parameters));
		} else {
			api_url += "?parameters=" + new Buffer(JSON.stringify(parameters)).toString('base64');
		}
	return api_url;
	
};

HappnClient.prototype.getChannel = function(path, action){
	this.checkPath(path);

	return '/' + action.toUpperCase() + '@' + path;
};

HappnClient.prototype.get = function(path, parameters, handler){
	this.performRequest(path, 'get', null, parameters, handler);
};

HappnClient.prototype.getChild = function(path, childId, handler){
	this.get(path, {child_id:childId}, handler);
};

HappnClient.prototype.getPaths = function(path, handler){
	this.get(path, {options:{path_only:true}}, handler);
};

HappnClient.prototype.set = function(path, data, parameters, handler){
	this.performRequest(path, 'set', data, parameters, handler);
};

HappnClient.prototype.setChild = function(path, data, handler){
	this.set(path, data, {set_type:'child'}, handler);
};

HappnClient.prototype.setSibling = function(path, data, handler){
	this.set(path, data, {set_type:'sibling'}, handler);
};

HappnClient.prototype.remove = function(path, parameters, handler){
	//path, action, data, parameters, done
	return this.performRequest(path, 'remove', null, parameters, handler);
};

HappnClient.prototype.removeChild = function(path, childId, handler){
	this.remove(path, {child_id:childId}, handler);
};

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
		this.log.error('Socket error', err);

};


HappnClient.prototype.handle_publication = function(message){
	if (message.type == 'data'){
	  	this.handle_data(message.channel, message);
  	}else if (message.type == 'message'){
  		this.handle_message(message);
  	}else if (message.type == "response"){
  		this.handle_response(message);
  	}
};

HappnClient.prototype.handle_response = function(response){
	var responseHandler = this.requestEvents[response.eventId];

	if (responseHandler)
		responseHandler.handleResponse(response);
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

					delegate.handler.call(_this, message);
				});
			}else 
				delegate.handler.call(_this, message);

		});			
	};
};

HappnClient.prototype.onMessage = function(key, type, handler, done){

	try{
		
		if (!this.messageEvents[type])
			this.messageEvents[type] = [];

		this.messageEvents[type].push({"key":key, "handler":handler});

		done();

	}catch(e){
		done(e);
	}
};

HappnClient.prototype._remoteOn = function(path, refCount, done){
	this.performRequest(path, 'on', this.session, {"refCount":refCount}, done);
}

HappnClient.prototype.on = function(path, parameters, handler, done){

	var _this = this;

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
};

HappnClient.prototype.onAll = function(handler, done){
	this.on('*', null, handler, done);
};

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
		if (channel.split('@')[1] == path){
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

HappnClient.prototype.offAll = function(done){
	var _this = this;

	return _this._remoteOff('*', 0, function(e){
		if (e)
			return done(e);

		_this.events = {};
		done();
	});
}

HappnClient.prototype.off = function(listenerRef, done){

	if (!listenerRef)
		return done(new Error('listenerRef cannot be null'));

	if (typeof listenerRef == "number")
		return this._offListener(listenerRef, done);
	
	return this._offPath(listenerRef, done);
}


})(); // end enclosed

