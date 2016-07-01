var Primus = require('primus'),
	path = require('path'),
	shortid = require('shortid'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter

module.exports = PubSubService;

function PubSubService(opts) {

  this.log = opts.logger.createLogger('PubSub');
  this.log.$$TRACE('construct(%j)', opts);

	this.__sessions = [];
	this.__released_sessions = [];
	this.__listeners_SET = {};
	this.__listeners_REMOVE = {};
	this.__listeners_ALL = {};
	this.__listeners_ONALL = {};
	this.__listeners_wildcard_ALL = {};
	this.__listeners_wildcard_SET = {};
	this.__listeners_wildcard_REMOVE = {};
	this.trusted = {};

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
    try{

    	var _this = this;

    	if (typeof options == 'function'){
    		done = options;
    		options = {};
    	}

    	if (this.primus){

    		if (!options.timeout)
    			options.timeout = 5000;

    		var shutdownTimeout = setTimeout(function(){
	    		_this.log.error('primus destroy timed out after ' + options.timeout + ' milliseconds');
	    		_this.__shutdownTimeout = true;//instance level flag to ensure done is not called multiple times
	    		done();
	    	}, options.timeout);

    		this.primus.destroy({
    			// // have primus close the http server and clean up
    			close: true,
    			// have primus inform clients to attempt reconnect
    			reconnect: typeof options.reconnect === 'boolean' ? options.reconnect : true
    		}, function(e){
    			//we ensure that primus didn't time out earlier
    			if (!_this.__shutdownTimeout){
    				clearTimeout(shutdownTimeout);
    				done(e);
    			}
    		});
    	}
    	else
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
		_this.securityService = _this.happn.services.security.safe();
		_this.__shutdownTimeout = false;//used to flag an incomplete shutdown

		if (config.secure){

			_this.securityService.onDataChanged(_this.securityDirectoryChanged.bind(_this));

		}else{

			_this.authorizeRequest = function(socket, message, callback){
				callback();
			}

			_this.login = function(message, socket){
				_this.handleDataResponseSocket(null, message, {data: _this.attachSession(socket, _this.securityService.generateEmptySession(), message.data.info)}, socket);
				this.emit('authentic', {info: socket.session.info, session:{id:socket.session.id}});
			}

		}

		_this.primus = new Primus(_this.happn.server, {});
		_this.primus.on('connection', _this.onConnect.bind(_this));
		_this.primus.on('disconnection', _this.onDisconnect.bind(_this));

		if (_this.happn.config.encryptPayloads){
			_this.primus.transform('incoming', _this.incomingTransform.bind(_this));
			_this.primus.transform('outgoing', _this.outgoingTransform.bind(_this));
		}

		var clientPath = path.resolve(__dirname, '../../public');

		// happner is using this to create the api/client package
		_this.script = process.env.PRIMUS_SCRIPT || clientPath + '/browser_primus.js';

		_this.primus.save(_this.script);

		_this.config = config;

		done();

	}catch(e){
		done(e);
	}
}

PubSubService.prototype.incomingTransform = function(packet, next){

	if (this.happn.config.encryptPayloads){

		try{
			if (packet.data.action == 'login'){

				if (packet.data.data.encrypted.type == 'Buffer'){
					packet.data.data.encrypted = packet.data.data.encrypted.data;
				}

				packet.data.data = JSON.parse(this.happn.services.crypto.asymmetricDecrypt(packet.data.data.publicKey, this.happn.services.security._keyPair.privateKey, packet.data.data.encrypted).toString());
				delete packet.data.data.encrypted;

			}else if (packet.data.action == 'describe'){
				return next();
			}else{
				var session = this.getSession(packet.data.sessionId);
				packet.data = this.happn.services.crypto.symmetricDecryptObject(packet.data.encrypted, session.secret);
			}
		}catch(e){
			return next(e);
		}

	}

	next();

}

PubSubService.prototype.outgoingTransform = function(packet, next){

	if (this.happn.config.encryptPayloads){

		try{

			//the _meta may have been added to the array, but for socket connections it is embedded as the last
			//item in the array
			if (Array.isArray(packet.data)){
				packet = {
					data:{
						_meta:packet._meta?packet._meta:packet.data[packet.data.length - 1],
						data:packet.data
					}
				}
			}

			if (packet.data._meta.action == 'login'){

				if (packet.data._meta && packet.data._meta.status == 'error')
					return;

				packet.data.encrypted = this.happn.services.crypto.asymmetricEncrypt(packet.data.data.user.publicKey, this.happn.services.security._keyPair.privateKey, JSON.stringify(packet.data));
				packet.data._meta = {type:'login'};
				packet.data.publicKey = this.happn.services.security._keyPair.publicKey;

				delete packet.data.data;

			}
			else if (packet.data._meta.action == 'describe'){

				return next();

			}else{

				var session = this.getSession(packet.data._meta.sessionId);
				packet.data.encrypted = this.happn.services.crypto.symmetricEncryptObject(packet.data, session.secret);

				delete packet.data.data;
				delete packet.data._meta;

			}
		}catch(e){
			return next(e);
		}
	}

	next();
}

PubSubService.prototype.formatReturnItem = function(item){

  if (!item) return null;

  if (!item.data) item.data = {};

  var returnItem = item.data;
  returnItem._meta = item._meta;

  return returnItem;
}

PubSubService.prototype.formatReturnItems = function(items){
  var _this = this;

  if (items == null)
    items = [];

  if (!Array.isArray(items))
    items = [items];

  var returnItems = [];

  items.map(function(item){
    returnItems.push(_this.formatReturnItem(item));
  });

  return returnItems;
}

PubSubService.prototype.createResponse = function(e, message, response, local) {
  // this.log.info('XXX - createResponse()');
  var _this = this;

	if (!response) response = {data:null};

	var _meta = response._meta?response._meta:{};

	_meta.type = 'response';
	_meta.status = 'ok';
	_meta.published = false;
	_meta.eventId = message.eventId;

	//we need these passed in case we are encrypting the resulting payload
	if (['login','describe'].indexOf(message.action) > -1){
		_meta.action = message.action;
	}else{
		_meta.sessionId = message.sessionId;
		_meta.action = message.action;
	}

	if (response.paths)
		response = response.paths;

	response._meta = _meta;

	if (e) {

		response._meta.status = 'error';
		response._meta.error = {
			name: e.toString()
		};

		if (typeof e === 'object'){
			Object.keys(e).forEach(function(key) {
				response._meta.error[key] = e[key];
			});
		}

		return response;
	}

	if (['set', 'remove'].indexOf(message.action) > -1) {
		if (!message.parameters || !message.parameters.noPublish) {
			this.publish(message, response);
		}

		return response;
	}

  if (message.action == 'on' && (message.parameters.initialCallback || message.parameters.initialEmit)){
    response.data = _this.formatReturnItems(response.initialValues);
  }

	if (Array.isArray(response)){

    response = _this.formatReturnItems(response);

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

  // this.log.info('XXX - handleDataResponseLocal()');

	if (e) return handler(e);

	if (!response) return handler(null, response);

	var localResponse = this.createResponse(null, message, response, true);

  // this.log.info('XXX - createResponse() done');

	var decoded;

	if (localResponse && localResponse.data){
		decoded = localResponse.data;
		decoded._meta = localResponse._meta;
	} else {
		decoded = localResponse;
	}

	if (handler) {

		if (decoded && decoded._meta.status == 'error') {
			return handler(decoded);
		}

		//remove the _meta tag from the return array - as we have a matching handler already
		if (message.action == 'get' && Array.isArray(decoded)) delete decoded._meta;

		return handler(null, decoded);
	} else {
		if (decoded._meta.status == 'error') {
			client.handle_error(decoded);
		}
	}

}

// PubSubService.prototype.handleDataResponseLocal = function(e, message, response, handler, client) {

// 	if (e) return handler(e);

// 	if (!response) return handler(null, response);

// 	var localResponse = this.createResponse(null, message, response, true);

// 	var decoded;

// 	if (localResponse && localResponse.data){
// 		decoded = localResponse.data;
// 		decoded._meta = localResponse._meta;
// 	} else {
// 		decoded = localResponse;
// 	}

// 	if (handler) {
// 		if (decoded) {
// 			if (decoded._meta.status == 'error') {
// 				return handler(decoded);
// 			}
// 		}
// 		return handler(null, decoded);
// 	} else {
// 		if (decoded._meta.status == 'error') {
// 			client.handle_error(decoded);
// 		}
// 	}

// }

PubSubService.prototype.login = function(message, socketInstance){

	var _this = this;

	if (!message.data)
		return _this.handleDataResponseSocket(_this.securityService.AccessDeniedError('Invalid credentials'), message, null, socketInstance);

	_this.securityService.login(message.data, function(e, session){

		if (e) return _this.handleDataResponseSocket(e, message, null, socketInstance);

		_this.handleDataResponseSocket(null, message, {data: _this.attachSession(socketInstance, session, message.data.info)}, socketInstance);

	});
}

PubSubService.prototype.handle_message = function(message, socketInstance) {
	var _this = this;

	try {
		if (message.action == 'login') {

			return _this.login(message, socketInstance);

		} else if (message.action == 'describe') {

			var serviceDescription = _this.happn.services.system.getDescription();
			return _this.handleDataResponseSocket(null, message, {data:serviceDescription}, socketInstance);

		} else {

			_this.validateRequest(socketInstance, message, function(){

				_this.authorizeRequest(socketInstance, message, function(){

					if (message.action == 'get'){
						_this.dataService.get(message.path, message.parameters,
							function(e, response) {
								_this.handleDataResponseSocket(e, message, response, socketInstance);
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
						_this.addListener(message.path, socketInstance.session.index, message.parameters);
            _this.__doSubscriptionCallback(socketInstance, message);
					}else if (message.action == 'off'){
						_this.removeListener(message.token, message.path, message.parameters);
						_this.handleDataResponseSocket(null, message, {
							data: {},
							_meta: {
								status: 'ok'
							}
						}, socketInstance);
					}
				});
			});
		}

	}catch(e){
		return _this.handleDataResponseSocket(e, message, null, socketInstance);
	}
}

PubSubService.prototype.emitInitialValues = function(eventId, channel, socketInstance, initialItems){

  initialItems.map(function(item){

    item._meta.channel = channel.toString();
    item._meta.sessionId = socketInstance.session.id;
    item._meta.action = channel.toString();
    item._meta.type = 'data';

    item._meta.eventId = eventId;
    item._meta.status = 'ok';
    item._meta.published = false;

    socketInstance.write(item);
  });

}

PubSubService.prototype.__doSubscriptionCallback = function(socketInstance, message){
  var _this = this;

  var data = {
    data: {},
    _meta: {
      status: 'ok'
    }
  };

  var callback = function(){
    _this.handleDataResponseSocket(null, message, data, socketInstance);
  };

  var channel = message.path;
  var dataPath = message.path.split('@')[1];

  if (message.parameters.initialCallback || message.parameters.initialEmit){

    _this.dataService.get(dataPath, {sort:{"modified":1}}, function(e, initialItems){

      if (e) {
        data._meta.status = 'error';
        data.data = e.toString();
        return callback();
      }

      if (!initialItems)
        initialItems = [];

      if (initialItems && !Array.isArray(initialItems))
        initialItems = [initialItems];

      if (message.parameters.initialCallback){
        data.initialValues = initialItems;
        callback();
      }else{
        callback();
        _this.emitInitialValues(message.eventId, channel, socketInstance, initialItems);
      }

    });

  } else callback();
}

PubSubService.prototype.onConnect = function(socket) {
	var _this = this;

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

PubSubService.prototype.authorizeRequest = function(socket, message, callback){
	var _this = this;

	if (_this.trusted[socket.session.id] == undefined) return _this.handleDataResponseSocket(_this.securityService.AccessDeniedError('connection untrusted'), message, null, socket);

	if (message.action == 'off') return callback();//you dont need permission to stop listening

	_this.securityService.authorize(socket.session, message.path.replace(/^\/(?:REMOVE|SET|ALL)@/, ''), message.action, function(e, authorized){

		if (e) return _this.handleDataResponseSocket(e, message, null, socket);
		if (!authorized) return _this.handleDataResponseSocket(_this.securityService.AccessDeniedError('unauthorized'), message, null, socket);

		callback();
	});
}

PubSubService.prototype.validateRequest = function(socket, message, callback){
	var _this = this;

	if (['on','get','set','off','remove'].indexOf(message.action) == -1) return _this.handleDataResponseSocket('Unknown request action: ' + message["action"], message, null, socket);

	callback();
}

PubSubService.prototype.getSession = function(sessionId){

	var sessionIndex = this.trusted[sessionId];

	if (sessionIndex == undefined) return null;

	return this.__sessions[sessionIndex].session;
}

PubSubService.prototype.attachSession = function(socket, session, info){
	var _this = this;
	var sessionToken;

	if (!info) info = {};
	if (typeof info._local == 'undefined') info._local = false;

	info.happn = {
		name:_this.happn.name
	}

	session.info = info;

	var sessionIndex = 0;

	if (_this.__sessions.length > 0) {
		if (_this.__released_sessions.length > 0)
			sessionIndex = _this.__released_sessions.pop();
		else
			sessionIndex = _this.__sessions.length;
	}

	session.index = sessionIndex;
	socket.session = session;

	_this.__sessions[sessionIndex] = socket;
	_this.trusted[socket.session.id] = sessionIndex;

	_this.emit('authentic', {info: info, session:{id:session.id}});

	return session;
}

PubSubService.prototype.detachSession = function(socket){
	var _this = this;

	if (_this.__sessions[socket.session.index]){

		delete _this.trusted[socket.session.id];
		delete _this.__sessions[socket.session.index];
		_this.__released_sessions.push(socket.session.index);

	}

	this.emit('disconnect', {info: socket.session.info, session:{id:socket.session.id}});
}

PubSubService.prototype.connectLocal = function(handler, session) {
	var _this = this;

	var socket = {
		intraProc:true,
		write: function(message) {
			handler(message);
		},
		end: function(){
			_this.disconnect(this);
		}
	}

	var info = {_local: true, _browser: false}
	return _this.attachSession(socket, session, info);
}

PubSubService.prototype.disconnect = function(socket) {
	var _this = this;

	if (socket.session){

		_this.removeListener(socket.session.index, '*');
		_this.detachSession(socket);

	}
}

PubSubService.prototype.getAudienceGroup = function(channel, opts) {
  // this.log.info('XXX - getAudienceGroup() %s', channel);

  var _this = this;

  if (channel == '/ALL@*')//listeners subscribed to everything
    return _this.__listeners_ONALL;

  if (!opts) {
    // opts is missing in calls from addListener() and removeListener()
    opts = {
      hasWildcard: channel.indexOf('*') > -1,
      targetAction: channel.split('@')[0].replace('/','')
    }
  }

	if (opts.hasWildcard && channel.indexOf('/ALL@') == 0){//listeners subscribed to any action, but on a partial path
		return _this.__listeners_wildcard_ALL;
	} else if (opts.hasWildcard){//listeners subscribed to a specific action, but on a partial path
		return _this['__listeners_wildcard_' + opts.targetAction];
	} else {
		return _this['__listeners_' + opts.targetAction];
	}
}

PubSubService.prototype.emitToAudience = function(publication, channel, opts) {
  // this.log.info('XXX - emitToAudience() %s', channel);
	var _this = this;

	var audienceGroup = _this.getAudienceGroup(channel, opts);

	if (audienceGroup[channel] != null && audienceGroup[channel] != undefined) {

		var serialized;
		var decoupledPublication;

		for (var sessionIndex in audienceGroup[channel]) {

			if (_this.__sessions[sessionIndex].intraProc){
				//we deep clone for intra process comms
				decoupledPublication = _this.happn.utils.clone(publication, true);
			}else {
        //necessary because the socket write is non-blocking, this means we have to ensure
        //the packet data is decoupled here, even if the data goes over the wire
				//only JSON can make it over the wire, use JSON, more economical

        // if (!sharedRef.publication) {
        //   sharedRef.publication = JSON.parse(JSON.stringify(publication))
        // }
        // decoupledPublication = sharedRef.publication;

        if (!opts.serialized) {
          opts.serialized = JSON.stringify(publication)
        }
        // still requires a separate copy per subscriber
        // but only when payload encryption is turned on,
        // for all other cases this step could be shared
        // because the data is cloned by virtue of the fact
        // that it crosses the network
        decoupledPublication = JSON.parse(opts.serialized);
			}

			decoupledPublication._meta.channel = channel.toString();
			decoupledPublication._meta.sessionId = _this.__sessions[sessionIndex].session.id;

      // this.log.info('XXX - emitToAudience() writing');

			_this.__sessions[sessionIndex].write(decoupledPublication);

		}
	}
}

PubSubService.prototype.publish = function(message, payload) {
  // this.log.info('XXX - publish()');

	payload._meta.published = true;

	var action = message.action.toUpperCase();
	var messageChannel = '/' + action + '@' + message.path;

	var type = payload._meta.type; //this seems odd, gets reconnected at the end, but it must be emitted as type "data",
								   //then when control is passed back to the response, we need it to be type "response"
	payload._meta.action = messageChannel;
	payload._meta.type = 'data';

  var opts = {            // 1. to allow shared .serialized between repetitive calls to emitToAudience()
    hasWildcard: false,   // 2. to avert repetitive test for indexOf(*) in getAudienceGroup()
    targetAction: action  // 3. to avert repetitive parsing of channel string to determine action in getAudienceGroup()
  };

  	this.emitToAudience(payload, messageChannel, opts);
    opts.targetAction = 'ALL';
  	this.emitToAudience(payload, '/ALL@' + message.path, opts);
  	this.emitToAudience(payload, '/ALL@*', opts);

  opts.hasWildcard = true; // all remaining emit attempts are to wildcard subscribers

	for (var allPath in this.__listeners_wildcard_ALL){
    if (this.happn.utils.wildcardMatch(allPath.replace('/ALL@/','/*@/'), messageChannel)) {
      this.emitToAudience(payload, allPath, opts);
    }
	}

  opts.targetAction = action;

	var wildcardActionGroup = this['__listeners_wildcard_' + action];
	for (var actionPath in wildcardActionGroup){
		if (this.happn.utils.wildcardMatch(actionPath, messageChannel)){
			this.emitToAudience(payload, actionPath, opts);
		}
	}

  	payload._meta.type = type;
}

PubSubService.prototype.__notifyClient = function(socket, eventKey, data){
	socket.write({_meta:{type:'system'}, eventKey:eventKey, data:data});
}

PubSubService.prototype.securityDirectoryChanged = function(whatHappnd, changedData){

	var _this = this;

	if (['link-group', 'unlink-group','delete-user','delete-group'].indexOf(whatHappnd) > -1){

		try{

			_this.__sessions.every(function(socket){

				if (whatHappnd == 'link-group'){

					if (changedData._meta.path.indexOf('/_SYSTEM/_SECURITY/_USER/' + socket.session.user.username + '/_USER_GROUP/') == 0){

						var groupName = changedData._meta.path.replace('/_SYSTEM/_SECURITY/_USER/' + socket.session.user.username + '/_USER_GROUP/','');

						socket.session.user.groups[groupName] = changedData;
						socket.session.permissionSetKey = _this.securityService.generatePermissionSetKey(socket.session.user);

						return false;

					}
				}

				if (whatHappnd == 'unlink-group'){

					if (changedData.indexOf('/_SYSTEM/_SECURITY/_USER/' + socket.session.user.username + '/_USER_GROUP/') == 0){

						var groupName = changedData.replace('/_SYSTEM/_SECURITY/_USER/' + socket.session.user.username + '/_USER_GROUP/','');
						delete socket.session.user.groups[groupName];

						socket.session.permissionSetKey = _this.securityService.generatePermissionSetKey(socket.session.user);

						return false;
					}
				}

				if (whatHappnd == 'delete-user'){

					var userName = changedData.obj._meta.path.replace('/_SYSTEM/_SECURITY/_USER/','');

					if (socket.session.user.username == userName){

						_this.__notifyClient(socket, 'server-side-disconnect', 'security directory update: user deleted');
						socket.end();

						return false;
					}

				}

				if (whatHappnd == 'delete-group'){

					if (socket.session.user.groups[changedData.obj.name]){
						delete socket.session.user.groups[changedData.obj.name];
						socket.session.permissionSetKey = _this.securityService.generatePermissionSetKey(socket.session.user);
					}

				}

				return true;

			});

		}catch(e){
			this.log.error('failure updating security directory', e);
		}
	}

	return true;
}
