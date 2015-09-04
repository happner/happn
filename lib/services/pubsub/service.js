var Primus = require('primus'),
	wildcard = require('wildcard'),
	utc = require('moment').utc(),
	path = require('path'),
	shortid = require('shortid');
	
module.exports = {
	__sessions: [],
	__released_sessions:[],
	__listeners_SET: {},
	__listeners_REMOVE: {},
	__listeners_ALL: {},
	__listeners_ONALL: {},
	__listeners_wildcard_ALL: {},
	__listeners_wildcard_SET: {},
	__listeners_wildcard_REMOVE: {},
	__trusted: {},
	stats: function(opts){
		var _this = this;
		return {
			sessions:_this.__sessions,
			released_sessions:_this.__released_sessions,
			listeners_SET:_this.__listeners_SET,
			listeners_REMOVE:_this.__listeners_REMOVE,
			listeners_ALL:_this.__listeners_ALL,
			listeners_ONALL:_this.__listeners_ONALL,
			listeners_wildcard_ALL:_this.__listeners_wildcard_ALL,
			listeners_wildcard_SET:_this.__listeners_wildcard_SET,
			listeners_wildcard_REMOVE:_this.__listeners_wildcard_REMOVE
		}
	},
	stop: function(options, done){
        var _this = this;

        try{
            //_this.primus.stop();
            done();
        }catch(e){
            done(e);
        }
    },
	initialize: function(config, done) {
		var _this = this;
		try{

			if (config.timeout) config.timeout = false;

			_this.dataService = _this.happn.services.data;
			_this.authService = _this.happn.services.auth;

			_this.log = _this.happn.utils.createLogger('PubSub');
			_this.primus = new Primus(_this.happn.server, {});
			_this.primus.on('connection', _this.onConnect.bind(_this));
			_this.primus.on('disconnection', _this.onDisconnect.bind(_this));

			var clientPath = path.resolve(__dirname, '../../public');
			_this.primus.save(process.env.PRIMUS_SCRIPT || clientPath + '/browser_primus.js');

			done();

		}catch(e){
			done(e);
		}
	},

	createResponse: function(e, message, response) {

		var responseData = {
			type: "response",
			status: 'ok',
			payload: [],
			published: false,
			eventId: message.eventId
		}

		if (e) {
			responseData.status = 'error';
			responseData.payload = e.toString();
		} else {
			if (['set', 'remove'].indexOf(message.action) > -1) {

				if (!message.parameters || !message.parameters.options || !message.parameters
					.options.noPublish) {
					this.publish(message, response);
					responseData.published = true;
				}
				responseData.payload = response;
			} else if (message.action == "get") {
				if (Array.isArray(response)) {
					responseData.payload = response;
				} else {
					responseData.payload = response.toArray();
				}
			} else responseData.payload = response;
		}
		return responseData;
	},

	handleDataResponseSocket: function(e, message, response, socket) {
		return socket.write(this.createResponse(e, message, response));
	},
	handleDataResponseLocal: function(e, message, response, handler, client) {
		var response = this.createResponse(e, message, response);
		if (handler) {
			if (response.status == 'error') return handler(response);
			return handler(null, response);
		} else {
			if (response.status == 'error') {
				client.handle_error(response);
			}
		}
	},
	handle_message: function(message, socketInstance) {
		var _this = this;

		try {
				if (message.action == 'login') {

					
					
					if (!message.data)
						return _this.handleDataResponseSocket('Unauthenticated request, no credentials', message, response, socketInstance);
					_this.attachSession(socketInstance, message.data);
					return _this.handleDataResponseSocket(null, message, socketInstance.session, socketInstance);
				} else {

					if (_this.validateRequest(socketInstance)){

						if (message.action == 'get'){
							_this.dataService.get(message.path, message.parameters,
								function(e, response) {
									_this.handleDataResponseSocket(e, message, response,
										socketInstance);
								});
						}else if (message.action == 'set'){
							if (message.parameters.noStore) return _this.handleDataResponseSocket(
								null, message, _this.dataService.transformSetData(message
									.path, message.data), socketInstance);
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
							_this.addListener(message.path, socketInstance.session.index, message.parameters);
							_this.handleDataResponseSocket(null, message, {
								status: 'ok'
							}, socketInstance);
						}else if (message.action == 'off'){
							_this.removeListener(message.token, message.path, message.parameters);
							_this.handleDataResponseSocket(null, message, {
								status: 'ok'
							}, socketInstance);
						}else{
							return _this.handleDataResponseSocket('Unknown request action: ' +
								message["action"], message, null, socketInstance);
						}

					} else throw new Error('Unauthorized request', message);	
							
			}

		}catch(e){
			return _this.handleDataResponseSocket(e, message, null, socketInstance);
		}
	},
	onConnect: function(socket) {
		var _this = this;
		//_this.log.$$TRACE('onConnect', arguments);

		socket.on('error', function(err) {
			_this.log.error('socket error', err);
		});

		socket.on('data', function(message) {
			_this.handle_message(message, socket);
		});
	},
	onDisconnect: function(socket) {
		var _this = this;
		_this.disconnect(socket);
	},
	getAudienceGroup: function(channel) {
		var _this = this;
		//_this.log.$$TRACE('getListenerDict', arguments);
		var channelParts = channel.split('@')
		var action = channelParts[0].replace('/','');;
		var actionPath = channelParts[1];
		var audienceGroup;

		if (channel == '/ALL@*') {
			audienceGroup = _this.__listeners_ONALL;
		}else if (channel.indexOf('*') > -1){
			audienceGroup = _this['__listeners_wildcard_' + action];
		}else{
			audienceGroup = _this['__listeners_' + action];
		}

		return audienceGroup;
	},
	addListener: function(channel, sessionIndex, parameters) {
		var _this = this;

		var channelParts = channel.split('@');
		var action = channelParts[0].replace('/','');;
		
		var audienceGroup = _this.getAudienceGroup(channel);

		if (!audienceGroup[channel]) audienceGroup[channel] = {};

		var refCount = parameters.refCount;

		if (!refCount)
			refCount = 1;

		if (!audienceGroup[channel][sessionIndex]) 
			audienceGroup[channel][sessionIndex] = refCount;
		else 
			audienceGroup[channel][sessionIndex] += refCount;

	},
	decrementEventReference: function(audienceGroup, sessionIndex, channel, refCount){

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
	},
	removeListener: function(sessionIndex, channel, parameters) {
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
	},
	message: function(type, socket, data) {
		socket.write({
			type: "message",
			"messageType": type,
			"data": data
		});
	},
	validateRequest:function(socket){
		var _this = this;

		//////console.log('validating socket.session');
		//////console.log(socket.session);

		//TODO - add security layer here.

		return true;
	},
	attachSession:function(socket, credentials){
		var _this = this;
		var sessionToken;

		socket.session = _this.authService.newSession(credentials);

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

	},
	detachSession:function(socket){
		var _this = this;

		if (_this.__sessions[socket.session.index]){
			delete _this.__sessions[socket.session.index];
			_this.__released_sessions.push(socket.session.index);
		}
	},
	connect: function(handler) {
		var _this = this;
		var socket = {
			write: function(message) {
				handler(message);
			}
		}
		return _this.attachSession(socket);
	},
	disconnect: function(socket) {
		var _this = this;

		if (socket.session){
			_this.removeListener(socket.session.index, '*');
			_this.detachSession(socket);		
		}
	},
	emitToAudience: function(audienceGroup, publication, channel) {
		var _this = this;
		if (audienceGroup[channel]) {
			for (var sessionIndex in audienceGroup[channel]) {
				publication.channel = channel.toString();
				_this.__sessions[sessionIndex].write(publication);
			}
		}
	},
	publish: function(message, payload) {
		var _this = this;
	
		var action = message.action.toUpperCase();
		var messageChannel = '/' + action + '@' + message.path;

		var channels = [messageChannel,
			'/ALL@' + message.path,
			'/ALL@*'];
		
        var publication = {"timestamp":utc.valueOf(), "type":"data", "payload":payload, "action":messageChannel};

        channels.every(function(channel){
        	_this.emitToAudience(_this.getAudienceGroup(channel), publication, channel);
        	return true;
        });

        
        for (var allPath in _this.__listeners_wildcard_ALL){
        	if (wildcard(allPath, messageChannel))
        		_this.emitToAudience(_this.__listeners_wildcard_ALL[actionPath], publication, allPath);
        }

        var wildcardActionGroup = _this['__listeners_wildcard_' + action];
        for (var actionPath in wildcardActionGroup){
        	if (wildcard(actionPath, messageChannel))
        		_this.emitToAudience(wildcardActionGroup, publication, actionPath);
        }
       
	}
}