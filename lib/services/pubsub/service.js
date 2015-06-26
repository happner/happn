var Primus = require('primus'),
	wildcard = require('wildcard'),
	utc = require('moment').utc(),
	async = require('async'),
	path = require('path'),
	shortid = require('shortid');
	
module.exports = {
	sessions: {},
	listeners_SET: {},
	listeners_REMOVE: {},
	listeners_ALL: {},
	listeners_ONALL: {},
	listeners_wildcard_ALL: {},
	listeners_wildcard_SET: {},
	listeners_wildcard_REMOVE: {},
	trusted: {},
	initialize: function(config, done) {
		var _this = this;
		if (config.timeout) config.timeout = false;
		_this.dataService = _this.happn.services.data;
		_this.authService = _this.happn.services.auth;
		_this.utils = _this.happn.utils;
		_this.primus = new Primus(_this.happn.server, {});
		_this.primus.on('connection', _this.onConnect.bind(_this));
		_this.primus.on('disconnection', _this.onDisconnect.bind(_this));

		var clientPath = path.resolve(__dirname, '../../public');
		_this.primus.save(clientPath + '/browser_primus.js');
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

		//_this.utils.log('handle_message', 'trace', 'service-pubsub', arguments);
		if (!message.eventId) return socketInstance.write({
			status: 'error',
			message: 'All messages must have an eventId',
			type: 'notification'
		});

		if (!message.token && message["action"] != 'login') return _this.handleDataResponseSocket('Unauthenticated request, no session token', message, response, socketInstance);

		if (!message.parameters) message.parameters = {};

		try {
			if (message.action == 'login') {
				
				if (!message.data)
					return _this.handleDataResponseSocket('Unauthenticated request, no credentials', message, response, socketInstance);

				var sessionToken = _this.attachSession(socketInstance, message.data);
				return _this.handleDataResponseSocket(null, message, sessionToken, socketInstance);

			} else {
				_this.happn.services.auth.decodeToken(message.token);
				switch (message.action) {
					case 'on':
						_this.addListener(message.path, message.token);
						_this.handleDataResponseSocket(null, message, {
							status: 'ok'
						}, socketInstance);
						break;
					case 'off':
						_this.removeListener(message.token, message.path, message.parameters.decrementBy);
						_this.handleDataResponseSocket(null, message, {
							status: 'ok'
						}, socketInstance);
						break;
					case 'remove':
						_this.dataService.remove(message.path, message.parameters,
							function(e, response) {
								_this.handleDataResponseSocket(e, message, response,
									socketInstance);
							});
						break;
					case 'set':
						if (message.parameters.noStore) return _this.handleDataResponse(
							null, message, _this.dataService.transformSetData(message
								.path, message.data), socketInstance);
						_this.dataService.upsert(message.path, message.data, message.parameters,
							function(e, response) {
								_this.handleDataResponseSocket(e, message, response,
									socketInstance);
							});
						break;
					case 'get':
						_this.dataService.get(message.path, message.parameters,
							function(e, response) {
								_this.handleDataResponseSocket(e, message, response,
									socketInstance);
							});
						break;
					default:
						return _this.handleDataResponseSocket('Unknown request action: ' +
							message["action"], message, null, socketInstance);
				}
			}
		} catch (e) {
			return _this.handleDataResponseSocket(e, message, null, socketInstance);
		}
	},
	onConnect: function(socket) {
		var _this = this;
		//_this.utils.log('onConnect', 'trace', 'service-pubsub', arguments);

		socket.on('data', function(message) {
			_this.handle_message(message, socket);
		});
	},
	onDisconnect: function(socket) {
		var _this = this;
		_this.disconnect(socket.happnToken);
	},
	getAudienceGroup: function(channel) {
		var _this = this;
		//_this.utils.log('getListenerDict', 'trace', 'service-pubsub', arguments);
		var channelParts = channel.split('@')
		var action = channelParts[0].replace('/','');;
		var actionPath = channelParts[1];
		var audienceGroup;

		if (channel == '/ALL@*') {
			audienceGroup = _this.listeners_ONALL;
		}else if (channel.indexOf('*') > -1){
			audienceGroup = _this['listeners_wildcard_' + action];
		}else{
			audienceGroup = _this['listeners_' + action];
		}

		return audienceGroup;
	},
	addListener: function(channel, sessionToken) {
		var _this = this;

		var channelParts = channel.split('@');
		var action = channelParts[0].replace('/','');;
		
		var audienceGroup = _this.getAudienceGroup(channel);

		if (!audienceGroup[channel]) audienceGroup[channel] = {};

		if (!audienceGroup[channel][sessionToken]) 
			audienceGroup[channel][sessionToken] = 1;
		else 
			audienceGroup[channel][sessionToken] += 1;

	},
	decrementEventReference: function(audienceGroup, sessionToken, channel, decrementBy){

		var _this = this;
		
		if (!channel){
			for (var channel in audienceGroup){
				if (audienceGroup[channel]){
					
					if (audienceGroup[channel][sessionToken])
						delete audienceGroup[channel][sessionToken];

					if (Object.keys(audienceGroup[channel]).length == 0)
						delete audienceGroup[channel];
				}
			}
		}else{
			if (audienceGroup[channel] && audienceGroup[channel][sessionToken]){
				audienceGroup[channel][sessionToken] -= decrementBy;//decrement the listener counter

				if (audienceGroup[channel][sessionToken] <= 0){
					delete audienceGroup[channel][sessionToken];

					if (Object.keys(audienceGroup[channel]).length == 0)
						delete audienceGroup[channel];
				}
			}
		}
	},
	removeListener: function(sessionToken, channel, decrementBy) {
		var _this = this;
		if (channel == "*"){ 
			_this.decrementEventReference(_this.listeners_SET, sessionToken);
			_this.decrementEventReference(_this.listeners_REMOVE, sessionToken);
			_this.decrementEventReference(_this.listeners_ALL, sessionToken);
			_this.decrementEventReference(_this.listeners_ONALL, sessionToken);
			_this.decrementEventReference(_this.listeners_wildcard_ALL, sessionToken);
			_this.decrementEventReference(_this.listeners_wildcard_SET, sessionToken);
			_this.decrementEventReference(_this.listeners_wildcard_REMOVE, sessionToken);
		}else{
			_this.decrementEventReference(_this.getAudienceGroup(channel), sessionToken, channel, decrementBy);
		}
	},
	message: function(type, socket, data) {
		//_this.utils.log('message', 'trace', 'service-pubsub', arguments);
		socket.write({
			type: "message",
			"messageType": type,
			"data": data
		});
	},
	attachSession:function(socket, credentials){
		var _this = this;
		var sessionToken;

		if (credentials)
			sessionToken = _this.authService.login(credentials);
		else
			sessionToken = _this.authService.generateToken();

		socket.happnToken = sessionToken;
		_this.sessions[sessionToken] = socket;

		return sessionToken;		
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
	disconnect: function(sessionToken) {
		var _this = this;
		_this.removeListener(sessionToken, '*');
		delete _this.sessions[sessionToken];		
	},
	emitToAudience: function(audienceGroup, publication, channel) {
		var _this = this;
	
		if (audienceGroup[channel]) {
			for (var socketId in audienceGroup[channel]) {
				publication.channel = channel.toString();
				_this.sessions[socketId].write(publication);
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
		
        delete message.token;
        var publication = {"timestamp":utc.valueOf(), "message":message, "type":"data", "payload":payload};

        channels.every(function(channel){
        	_this.emitToAudience(_this.getAudienceGroup(channel), publication, channel);
        	return true;
        });

        
        for (var allPath in _this.listeners_wildcard_ALL){
        	if (wildcard(allPath, messageChannel))
        		_this.emitToAudience(_this.listeners_wildcard_ALL[actionPath], publication, allPath);
        }

        var wildcardActionGroup = _this['listeners_wildcard_' + action];

        for (var actionPath in wildcardActionGroup){
        	if (wildcard(actionPath, messageChannel))
        		_this.emitToAudience(wildcardActionGroup, publication, actionPath);
        }
       
	}
}