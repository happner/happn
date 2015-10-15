var Primus = require('primus'),
	wildcard = require('wildcard'),
	// utc = require('moment').utc,
	path = require('path'),
	shortid = require('shortid'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter;

module.exports = PubSubService;

function PubSubService() {

	this.__sessions = [];
	this.__released_sessions = [];
	this.__listeners_SET = {};
	this.__listeners_REMOVE = {};
	this.__listeners_ALL = {};
	this.__listeners_ONALL = {};
	this.__listeners_wildcard_ALL = {};
	this.__listeners_wildcard_SET = {};
	this.__listeners_wildcard_REMOVE = {};
	this.__trusted = {};

}

// Enable subscription to key lifecycle events

util.inherits(PubSubService, EventEmitter);
	
PubSubService.prototype.stats = function(opts){
	return {
		sessions: this.__sessions,
		released_sessions: this.__released_sessions,
		listeners_SET: this.__listeners_SET,
		listeners_REMOVE: this.__listeners_REMOVE,
		listeners_ALL: this.__listeners_ALL,
		listeners_ONALL: this.__listeners_ONALL,
		listeners_wildcard_ALL: this.__listeners_wildcard_ALL,
		listeners_wildcard_SET: this.__listeners_wildcard_SET,
		listeners_wildcard_REMOVE: this.__listeners_wildcard_REMOVE
	}
}

PubSubService.prototype.stop = function(options, done){
    var _this = this;

    try{
        done();
    }catch(e){
        done(e);
    }
}

PubSubService.prototype.initialize = function(config, done) {
	var _this = this;
	try{

		if (config.timeout) config.timeout = false;

		_this.dataService = _this.happn.services.data;
		_this.securityService = _this.happn.services.security;

		_this.log = _this.happn.utils.createLogger('PubSub');
		_this.primus = new Primus(_this.happn.server, {});
		_this.primus.on('connection', _this.onConnect.bind(_this));
		_this.primus.on('disconnection', _this.onDisconnect.bind(_this));

		var clientPath = path.resolve(__dirname, '../../public');

		// happner is using this to create the api/client package
		_this.script = process.env.PRIMUS_SCRIPT || clientPath + '/browser_primus.js';

		_this.primus.save(_this.script);

		done();

	}catch(e){
		done(e);
	}
}

PubSubService.prototype.createResponse = function(e, message, response, local) {

	if (e && !response) response = {data: {}};

	if (!response)
		return null;

	var _meta = response._meta?response._meta:{};

	_meta.type = 'response';
	_meta.status = 'ok';
	_meta.published = false;
	_meta.eventId = message.eventId;

	if (response.paths)
		response = response.paths;
	
	response._meta = _meta;

	if (e) {

		response._meta.status = 'error';
		response._meta.error = e.toString();

		return response;
	}

	if (['set', 'remove'].indexOf(message.action) > -1) {
		
		if (!message.parameters || !message.parameters.options || !message.parameters.options.noPublish) {
			this.publish(message, response);
		}

		return response;
	}

	
	if (Array.isArray(response)){

		//remove references to data.blah
		response = response.map(function(item){
			if (item.data){
				item.data._meta = item._meta;
				return item.data;
			}
			return item;
		});

		if (!local)
			response.push(_meta);//we encapsulate the meta data in the array, so we canpop it on the other side
		else
			response._meta = _meta;// the _meta is preserved as an external property because we arent having to serialize
	}
	
	return response;
}

PubSubService.prototype.handleDataResponseSocket = function(e, message, response, socket) {
	return socket.write(this.createResponse(e, message, response, false));
}

PubSubService.prototype.decodeArrayResponse = function(response) {

	var decoded = response.map(function(item) {
		var obj = item.data;
		obj._meta = item._meta;
		// Object.defineProperty(obj, '_store', {
		// 	value: item._store,
		// 	enumerable: false,
		// 	configurable: true
		// });
		if (item._id) {
			// obj._store.path = item.path;
			obj._meta.id = item._id;
		}
		return obj;
	});

	// Object.defineProperty(decoded, '_event', {
	// 	value: response._event,
	// 	enumerable: response._event.status == 'error',
	// 	configurable: true
	// });
	decoded._meta = response._meta;
	return decoded;
}

PubSubService.prototype.handleDataResponseLocal = function(e, message, response, handler, client) {
	var localResponse = this.createResponse(e, message, response, true);
	var decoded;

	if (localResponse && localResponse.data){
		decoded = localResponse.data;
		decoded._meta = localResponse._meta;
	} else {
		decoded = localResponse;
	}

	if (handler) {
		if (decoded) {
			if (decoded._meta.status == 'error') {
				return handler(decoded);
			}
		}
		return handler(null, decoded);
	} else {
		if (decoded._meta.status == 'error') {
			client.handle_error(decoded);
		}
	}	
}

PubSubService.prototype.handle_message = function(message, socketInstance) {
	var _this = this;

	// console.log('message', message);

	try {
			if (message.action == 'login') {

				if (!message.data)
					return _this.handleDataResponseSocket('Unsecurityenticated request, no credentials', message, response, socketInstance);
				
				_this.attachSession(socketInstance, message.data, message.data.info);
				return _this.handleDataResponseSocket(null, message, {data: socketInstance.session}, socketInstance);
			} else {

				if (_this.validateRequest(socketInstance)){

					if (message.action == 'get'){
						_this.dataService.get(message.path, message.parameters,
							function(e, response) {

								_this.handleDataResponseSocket(e, message, response,
									socketInstance);
							});
					}else if (message.action == 'set'){
						if (message.parameters.noStore) return _this.handleDataResponseSocket(null, message, _this.dataService.formatSetData(message.path, message.data), socketInstance);
						_this.dataService.upsert(message.path, message.data, message.parameters,
							function(e, response) {
								_this.handleDataResponseSocket(e, message, response,
									socketInstance);
							});
					}else if (message.action == 'remove'){
						_this.dataService.remove(message.path, message.parameters,
						function(e, response) {
							_this.handleDataResponseSocket(e, message, response,
								socketInstance);
						});
					}else if (message.action == 'on'){

						// console.log('ON:', message.path, socketInstance.session.index, message.parameters);

						_this.addListener(message.path, socketInstance.session.index, message.parameters);
						_this.handleDataResponseSocket(null, message, {
							data: {},
							_meta: {
								status: 'ok'
							}
						}, socketInstance);
					}else if (message.action == 'off'){
						_this.removeListener(message.token, message.path, message.parameters);
						_this.handleDataResponseSocket(null, message, {
							data: {},
							_meta: {
								status: 'ok'
							}
						}, socketInstance);
					}else{
						return _this.handleDataResponseSocket('Unknown request action: ' +
							message["action"], message, null, socketInstance);
					}

				} else throw new Error('Unsecurityorized request', message);	
						
		}

	}catch(e){
		return _this.handleDataResponseSocket(e, message, null, socketInstance);
	}
}

PubSubService.prototype.onConnect = function(socket) {
	var _this = this;
	//_this.log.$$TRACE('onConnect', arguments);

	socket.on('error', function(err) {

		_this.log.error('socket error', err);
	});

	socket.on('data', function(message) {
		_this.handle_message(message, socket);
	});
}

PubSubService.prototype.onDisconnect = function(socket) {
	var _this = this;
	_this.disconnect(socket);
}

PubSubService.prototype.getAudienceGroup = function(channel) {
	var _this = this;
	//_this.log.$$TRACE('getListenerDict', arguments);
	var action = '';
	var actionPath = '';
	
	channel.split('@').map(function(segment, index){
		if (index > 0)
			actionPath += segment;
		else
			action = segment.replace('/','');
	});

	var audienceGroup;

	if (channel == '/ALL@*') {
		audienceGroup = _this.__listeners_ONALL;
	}else if (channel.indexOf('*') > -1){
		audienceGroup = _this['__listeners_wildcard_' + action];
	}else{
		audienceGroup = _this['__listeners_' + action];
	}

	return audienceGroup;
}

PubSubService.prototype.addListener = function(channel, sessionIndex, parameters) {
	var _this = this;

	var audienceGroup = _this.getAudienceGroup(channel);

	if (!audienceGroup[channel]) audienceGroup[channel] = {};

	var refCount = parameters.refCount;

	if (!refCount)
		refCount = 1;

	if (!audienceGroup[channel][sessionIndex]) 
		audienceGroup[channel][sessionIndex] = refCount;
	else 
		audienceGroup[channel][sessionIndex] += refCount;

}

PubSubService.prototype.decrementEventReference = function(audienceGroup, sessionIndex, channel, refCount){

	var _this = this;
	
	if (!channel){
		for (var channel in audienceGroup){
			if (audienceGroup[channel]){
				
				if (audienceGroup[channel][sessionIndex])
					delete audienceGroup[channel][sessionIndex];

				if (Object.keys(audienceGroup[channel]).length == 0)
					delete audienceGroup[channel];
			}
		}
	}else{
		if (audienceGroup[channel] && audienceGroup[channel][sessionIndex]){
			audienceGroup[channel][sessionIndex] -= refCount;//decrement the listener counter

			if (audienceGroup[channel][sessionIndex] <= 0){
				delete audienceGroup[channel][sessionIndex];

				if (Object.keys(audienceGroup[channel]).length == 0)
					delete audienceGroup[channel];
			}
		}
	}
}

PubSubService.prototype.removeListener = function(sessionIndex, channel, parameters) {
	var _this = this;
	if (channel == "*"){ 
		_this.decrementEventReference(_this.__listeners_SET, sessionIndex);
		_this.decrementEventReference(_this.__listeners_REMOVE, sessionIndex);
		_this.decrementEventReference(_this.__listeners_ALL, sessionIndex);
		_this.decrementEventReference(_this.__listeners_ONALL, sessionIndex);
		_this.decrementEventReference(_this.__listeners_wildcard_ALL, sessionIndex);
		_this.decrementEventReference(_this.__listeners_wildcard_SET, sessionIndex);
		_this.decrementEventReference(_this.__listeners_wildcard_REMOVE, sessionIndex);
	}else{
		_this.decrementEventReference(_this.getAudienceGroup(channel), sessionIndex, channel, parameters.refCount);
	}
}


// PubSubService.prototype.message = function(type, socket, data) {
// 	socket.write({
// 		type: "message",
// 		"messageType": type,
// 		"data": data
// 	});
// }

PubSubService.prototype.validateRequest = function(socket){
	var _this = this;

	//////console.log('validating socket.session');
	//////console.log(socket.session);

	//TODO - add security layer here.

	return true;
}

PubSubService.prototype.attachSession = function(socket, credentials, info){
	var _this = this;
	var sessionToken;

	socket.session = _this.securityService.newSession(credentials);

	if (!info) info = {};
	if (typeof info._local == 'undefined') info._local = false;
	socket.session.info = info;

	//this.emit('authentic', {info: info});

	var sessionIndex = 0;

	if (_this.__sessions.length > 0){
		if (_this.__released_sessions.length > 0)
			sessionIndex = _this.__released_sessions.pop();
		else
			sessionIndex = _this.__sessions.length;
	}
	
	//console.log('attaching', sessionIndex);
	socket.session.index = sessionIndex;
	_this.__sessions[sessionIndex] = socket;

	return socket.session;

}
	
PubSubService.prototype.detachSession = function(socket){
	var _this = this;

	if (_this.__sessions[socket.session.index]){
		delete _this.__sessions[socket.session.index];
		_this.__released_sessions.push(socket.session.index);
	}
}

PubSubService.prototype.connect = function(handler) {
	var _this = this;
	var socket = {
		write: function(message) {
			handler(message);
		}
	}
	var info = {_local: true, _browser: false}
	return _this.attachSession(socket, undefined, info);
}

PubSubService.prototype.disconnect = function(socket) {
	var _this = this;

	if (socket.session){

		if (socket.session.info) this.emit('disconnect', {info: socket.session.info});

		_this.removeListener(socket.session.index, '*');
		_this.detachSession(socket);
	}
}

PubSubService.prototype.emitToAudience = function(audienceGroup, publication, channel) {
	var _this = this;
	if (audienceGroup[channel]) {
		publication._meta.channel = channel.toString();
		for (var sessionIndex in audienceGroup[channel]) {
			_this.__sessions[sessionIndex].write(publication);
		}
	}
}

PubSubService.prototype.publish = function(message, payload) {
	var _this = this;

	payload._meta.published = true;

	var action = message.action.toUpperCase();
	var messageChannel = '/' + action + '@' + message.path;

	var channels = [messageChannel,
		'/ALL@' + message.path,
		'/ALL@*'];

	var type = payload._meta.type; //this seems odd, gets reconnected at the end, but it must be emitted as type "data", 
								   //then when control is passed back to the response, we need it to be type "response"

	payload._meta.action = messageChannel;
	payload._meta.type = 'data';
	
  	channels.every(function(channel){

  		var group = _this.getAudienceGroup(channel);
	  	_this.emitToAudience(group, payload, channel);
	  	return true;

  	});

	for (var allPath in _this.__listeners_wildcard_ALL){

	  	if (wildcard(allPath, messageChannel))
	  		_this.emitToAudience(_this.__listeners_wildcard_ALL[actionPath], payload, allPath);

	}

  	var wildcardActionGroup = _this['__listeners_wildcard_' + action];
	for (var actionPath in wildcardActionGroup){

		if (wildcard(actionPath, messageChannel))
	  		_this.emitToAudience(wildcardActionGroup, payload, actionPath);

	}

  	payload._meta.type = type;
}