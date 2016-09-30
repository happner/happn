var Primus = require('primus')
  , path = require('path')
  , shortid = require('shortid')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , async = require('async')
  , ms = require('ms')
  , Promise = require('bluebird')
  ;

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

PubSubService.prototype.stats = function (opts) {
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
};

PubSubService.prototype.processMessage = Promise.promisify(function(message, callback){
  try{

    console.log('PUBSUB HAPPENENING:::', message);

    var _this = this;

    if (message.request.action === 'on') {

      console.log('message.sessionId::::', message.sessionId);

      _this.addListener(message.request.path, message.sessionId, message.request.options);
      return _this.__doSubscriptionCallback(message, callback);

    } else if (message.request.action === 'off') {

      _this.removeListener(message.sessionId, message.request.path, message.request.options);

      message.response = {
        data: {},
        _meta: {
          status: 'ok'
        }
      };

    } else  if (['set', 'remove'].indexOf(message.request.action) > -1) {

      if (!message.request.options.noPublish) _this.publish(message.request, message.response);
    }

    return callback(null, message);

  }catch(e){
    callback(e);
  }
});

PubSubService.prototype.stop = function (options, callback) {
  try {

    var _this = this;

    if (typeof options == 'function') {
      callback = options;
      options = null;
    }

    if (!options) options = {};

    if (this.primus) {

      if (!options.timeout) options.timeout = 5000;

      var shutdownTimeout = setTimeout(function () {
        _this.log.error('primus destroy timed out after ' + options.timeout + ' milliseconds');
        _this.__shutdownTimeout = true;//instance level flag to ensure callback is not called multiple times
        callback();
      }, options.timeout);

      this.primus.destroy({
        // // have primus close the http server and clean up
        close: true,
        // have primus inform clients to attempt reconnect
        reconnect: typeof options.reconnect === 'boolean' ? options.reconnect : true
      }, function (e) {
        //we ensure that primus didn't time out earlier
        if (!_this.__shutdownTimeout) {
          clearTimeout(shutdownTimeout);
          callback(e);
        }
      });
    }
    else
      callback();

  } catch (e) {
    callback(e);
  }
};

PubSubService.prototype.initialize = function (config, callback) {
  var _this = this;

  // try {
  //
  //   if (!config) config = {};
  //
  //   if (!config.transformMiddleware) config.transformMiddleware = [];
  //
  //   if (config.timeout) config.timeout = false;
  //
  //   _this.dataService = _this.happn.services.data;
  //   _this.securityService = _this.happn.services.security.safe();
  //   _this.__shutdownTimeout = false;//used to flag an incomplete shutdown
  //
  //   if (config.secure) {
  //
  //     _this.securityService.onDataChanged(_this.securityDirectoryChanged.bind(_this));
  //
  //   } else {
  //
  //     _this.authorizeRequest = function (socket, message, callback) {
  //       callback();
  //     };
  //
  //     _this.login = function (message, socket) {
  //       _this.handleDataResponseSocket(null, message, {data: _this.attachSession(socket, _this.securityService.generateEmptySession(), message.data.info)}, socket);
  //       this.emit('authentic', {info: socket.session.info, session: {id: socket.session.id}});
  //     };
  //   }
  //
  //   _this.primus = new Primus(_this.happn.server, {});
  //   _this.primus.on('connection', _this.onConnect.bind(_this));
  //   _this.primus.on('disconnection', _this.onDisconnect.bind(_this));
  //
  //
  //   if (_this.happn.config.encryptPayloads) //always first incoming, last outgoing
  //     config.transformMiddleware.unshift({path:'./transform-payload-encryption'});
  //
  //   config.transformMiddleware.push({path:'./transform-message-protocol'});
  //
  //   var clientPath = path.resolve(__dirname, '../../public');
  //
  //   // happner is using this to create the api/client package
  //   _this.script = clientPath + '/browser_primus.js';
  //
  //   if (process.env.UPDATE_BROWSER_PRIMUS) _this.primus.save(_this.script);
  //
  //   _this.config = config;
  //
  //   _this.__initializeTransformMiddleware(_this.config, callback);
  //
  // } catch (e) {
  //   callback(e);
  // }

  callback();
};

PubSubService.prototype.__initializeTransformMiddleware = function(config, callback){

    var _this = this;

    if (!config.transformMiddleware || config.transformMiddleware.length == 0) return callback();

    _this.__transformers = [];

    async.eachSeries(config.transformMiddleware, function(middlewareConfig, middlewareCB){

      var middlewareInstance;

      if (middlewareConfig.path){
        var Middleware = require(middlewareConfig.path);
        middlewareInstance = new Middleware();
      }

      if (middlewareConfig.instance) middlewareInstance = middlewareConfig.instance;

      if (typeof middlewareInstance.incoming != 'function') return middlewareCB(new Error('transform middleware requires an "incoming" method'));
      if (typeof middlewareInstance.outgoing != 'function') return middlewareCB(new Error('transform middleware requires an "outgoing" method'));

      Object.defineProperty(middlewareInstance, '__pubsub', {value:_this, enumerable:true});

      _this.__transformers.push(middlewareInstance);

      if (middlewareInstance.initialized || typeof middlewareInstance.initialize != 'function') return middlewareCB();

      middlewareInstance.initialize(middlewareConfig.options, middlewareCB);

    }, function(e){

      if (e) return callback(e);

      _this.__transformers.reverse();

      //we need outbound messages to be transformed in reverse configuration, so they can match their incoming counterparts
      _this.__transformers.forEach(function(transformer){
        _this.primus.transform('outgoing', transformer.outgoing.bind(transformer));
      });

      _this.__transformers.reverse();//get the array back into the original order

      _this.__transformers.forEach(function(transformer){
        _this.primus.transform('incoming', transformer.incoming.bind(transformer));
      });

      callback();

    });

};

PubSubService.prototype.formatReturnItem = function (item, local) {

  if (!item) return null;

  if (!item.data) item.data = {};

  var returnItem = item.data;
  returnItem._meta = item._meta;

  return returnItem;
};

PubSubService.prototype.formatReturnItems = function (items, local) {

  if (items == null)
    items = [];

  if (!Array.isArray(items))
    items = [items];

  var returnItems = [];

  items.map(function (item) {
    returnItems.push(this.formatReturnItem(item, local));
  }.bind(this));

  return returnItems;
};

PubSubService.prototype.createResponse = function (e, message, response, local) {

  if (!response) response = {data: null};

  var _meta = response._meta ? response._meta : {};

  _meta.type = 'response';
  _meta.status = 'ok';
  _meta.published = false;
  _meta.eventId = message.eventId;

  delete _meta._id;

  //we need these passed in case we are encrypting the resulting payload
  if (['login', 'describe'].indexOf(message.action) > -1) {
    _meta.action = message.action;
  } else {
    _meta.sessionId = message.sessionId;
    _meta.action = message.action;
  }

  if (response.paths) response = response.paths;

  response._meta = _meta;

  if (e) {

    response._meta.status = 'error';

    response._meta.error = {
      name: e.toString()
    };

    if (typeof e === 'object') {
      Object.keys(e).forEach(function (key) {
        response._meta.error[key] = e[key];
      });
    }

    return response;
  }

  if (['set', 'remove'].indexOf(message.action) > -1) {
    if (!message.options || !message.options.noPublish) {
      this.publish(message, response);
    }
    return response;
  }

  if (message.action == 'on' && (message.options.initialCallback || message.options.initialEmit)) {
    response.data = this.formatReturnItems(response.initialValues, local);
  }

  if (Array.isArray(response)) {

    response = this.formatReturnItems(response, local);

    if (!local)
      response.push(_meta);//we encapsulate the meta data in the array, so we canpop it on the other side
    else
      response._meta = _meta;// the _meta is preserved as an external property because we arent having to serialize
  }

  return response;
};

PubSubService.prototype.handleDataResponseSocket = function (e, message, response, socket) {
  return socket.write(this.createResponse(e, message, response, false));
};

PubSubService.prototype.handleDataResponseLocal = function (e, message, response, handler, client) {

  if (e){
    if (handler) return handler(e);
    this.log.error('got error with no handler:', e);
    return;
  }

  if (!response) return handler(null, response);

  var localResponse = this.createResponse(null, message, response, true);

  var decoded;

  if (localResponse && localResponse.data) {

    decoded = localResponse.data;
    decoded._meta = localResponse._meta;

  } else decoded = localResponse;

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
};

PubSubService.prototype.login = function (message, socketInstance) {

  if (!message.data) return this.handleDataResponseSocket(_this.securityService.AccessDeniedError('Invalid credentials'), message, null, socketInstance);

  this.securityService.login(message.data, function (e, session) {

    if (e) return this.handleDataResponseSocket(e, message, null, socketInstance);

    this.handleDataResponseSocket(null, message, {data: this.attachSession(socketInstance, session, message.data.info)}, socketInstance);

  }.bind(this));//stateful
};

PubSubService.prototype.handle_message = function (message, socketInstance) {
  var _this = this;

  try {

    if (message.action == 'login') {

      return _this.login(message, socketInstance);

    } else if (message.action == 'describe') {

      var serviceDescription = _this.happn.services.system.getDescription();
      return _this.handleDataResponseSocket(null, message, {data: serviceDescription}, socketInstance);

    } else if (message.action == 'request-nonce') {

      _this.securityService.createAuthenticationNonce(message.data, function(e, nonce){

        if (e) return _this.handleDataResponseSocket(e, message, null, socketInstance);

        _this.handleDataResponseSocket(null, message, {data: {nonce:nonce}}, socketInstance);

      });

    } else {

      _this.validateRequest(socketInstance, message, function () {

        _this.authorizeRequest(socketInstance, message, function () {

          if (!message.options) message.options = {};

          if (message.action == 'get') {
            _this.dataService.get(message.path, message.options,
              function (e, response) {
                _this.handleDataResponseSocket(e, message, response, socketInstance);
              });
          } else if (message.action == 'set') {
            if (message.options.noStore) return _this.handleDataResponseSocket(null, message, _this.dataService.formatSetData(message.path, message.data), socketInstance);
            _this.dataService.upsert(message.path, message.data, message.options,
              function (e, response) {
                _this.handleDataResponseSocket(e, message, response,
                  socketInstance);
              });
          } else if (message.action == 'remove') {
            _this.dataService.remove(message.path, message.options,
              function (e, response) {
                _this.handleDataResponseSocket(e, message, response,
                  socketInstance);
              });
          } else if (message.action == 'on') {
            _this.addListener(message.path, socketInstance.session.index, message.options);
            _this.__doSubscriptionCallback(socketInstance, message);
          } else if (message.action == 'off') {
            _this.removeListener(message.token, message.path, message.options);
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

  } catch (e) {
    return _this.handleDataResponseSocket(e, message, null, socketInstance);
  }
};

PubSubService.prototype.emitInitialValues = function (eventId, channel, socketInstance, initialItems) {

  initialItems.map(function (item) {

    item._meta.channel = channel.toString();
    item._meta.sessionId = socketInstance.session.id;
    item._meta.action = channel.toString();
    item._meta.type = 'data';

    item._meta.eventId = eventId;
    item._meta.status = 'ok';
    item._meta.published = false;

    socketInstance.write(item);
  });

};

PubSubService.prototype.__doSubscriptionCallback = function (message, callback) {
  var _this = this;

  var data = {
    data: {},
    _meta: {
      status: 'ok'
    }
  };

  var doCallback = function () {
    message.response = data;
    callback(null, message);
  };

  var channel = message.request.path;
  var dataPath = message.request.path.split('@')[1];

  if (message.request.options.initialCallback || message.request.options.initialEmit) {

    _this.dataService.get(dataPath, {sort: {'modified': 1}}, function (e, initialItems) {

      if (e) {
        data._meta.status = 'error';
        data.data = e.toString();
        return doCallback();
      }

      if (!initialItems) initialItems = [];

      if (initialItems && !Array.isArray(initialItems)) initialItems = [initialItems];

      if (message.request.options.initialCallback) {
        data.initialValues = initialItems;
        doCallback();
      } else {
        doCallback();
        _this.emitInitialValues(message.request.eventId, channel, message.sessionId, initialItems);
      }
    });

  } else doCallback();
};

PubSubService.prototype.onConnect = function (socket) {
  var _this = this;

  socket.on('error', function (err) {
    _this.log.error('socket error', err);
  });

  socket.on('data', function (message) {
    _this.handle_message(message, socket);
  });
};

PubSubService.prototype.onDisconnect = function (socket) {
  this.disconnect(socket);
};

PubSubService.prototype.addListener = function (channel, sessionId, parameters) {

  var audienceGroup = this.getAudienceGroup(channel);

  if (!audienceGroup[channel]) audienceGroup[channel] = {};

  var refCount = parameters.refCount;

  if (!refCount) refCount = 1;

  if (!audienceGroup[channel][sessionId])
    audienceGroup[channel][sessionId] = refCount;
  else
    audienceGroup[channel][sessionId] += refCount;

};

PubSubService.prototype.decrementEventReference = function (audienceGroup, sessionId, channel, refCount) {

  if (!channel) {
    for (var channel in audienceGroup) {
      if (audienceGroup[channel]) {

        if (audienceGroup[channel][sessionId])
          delete audienceGroup[channel][sessionId];

        if (Object.keys(audienceGroup[channel]).length == 0)
          delete audienceGroup[channel];
      }
    }
  } else {
    if (audienceGroup[channel] && audienceGroup[channel][sessionId]) {
      audienceGroup[channel][sessionId] -= refCount;//decrement the listener counter

      if (audienceGroup[channel][sessionId] <= 0) {
        delete audienceGroup[channel][sessionId];

        if (Object.keys(audienceGroup[channel]).length == 0)
          delete audienceGroup[channel];
      }
    }
  }
};

PubSubService.prototype.removeListener = function (sessionId, channel, parameters) {
  if (channel == '*') {
    this.decrementEventReference(this.__listeners_SET, sessionId);
    this.decrementEventReference(this.__listeners_REMOVE, sessionId);
    this.decrementEventReference(this.__listeners_ALL, sessionId);
    this.decrementEventReference(this.__listeners_ONALL, sessionId);
    this.decrementEventReference(this.__listeners_wildcard_ALL, sessionId);
    this.decrementEventReference(this.__listeners_wildcard_SET, sessionId);
    this.decrementEventReference(this.__listeners_wildcard_REMOVE, sessionId);
  } else {
    this.decrementEventReference(this.getAudienceGroup(channel), sessionId, channel, parameters.refCount);
  }
};

PubSubService.prototype.authorizeRequest = function (socket, message, callback) {
  var _this = this;

  if (_this.trusted[socket.session.id] == undefined) return _this.handleDataResponseSocket(_this.securityService.AccessDeniedError('connection untrusted'), message, null, socket);

  if (message.action == 'off') return callback();//you dont need permission to stop listening

  _this.securityService.authorize(socket.session, message.path.replace(/^\/(?:REMOVE|SET|ALL)@/, ''), message.action, function (e, authorized, reason) {

    if (e) return _this.handleDataResponseSocket(e, message, null, socket);
    if (!authorized) return _this.handleDataResponseSocket(_this.securityService.AccessDeniedError('unauthorized', reason), message, null, socket);

    callback();
  });
};

PubSubService.prototype.validateRequest = function (socket, message, callback) {

  if (['on', 'get', 'set', 'off', 'remove'].indexOf(message.action) == -1)
    return this.handleDataResponseSocket('Unknown request action: ' + message['action'], message, null, socket);

  callback();
};

PubSubService.prototype.getSession = function (sessionId) {

  var sessionIndex = this.trusted[sessionId];

  if (sessionIndex == undefined) return null;

  return this.__sessions[sessionIndex].session;
};

PubSubService.prototype.attachSession = function (socket, session, info) {

  if (!info) info = {};
  if (typeof info._local == 'undefined') info._local = false;

  info.happn = {
    name: this.happn.name
  };

  session.info = info;
  session.type = 1;//stateful session

  var sessionIndex = 0;

  if (this.__sessions.length > 0) {
    if (this.__released_sessions.length > 0)
      sessionIndex = this.__released_sessions.pop();
    else
      sessionIndex = this.__sessions.length;
  }

  session.index = sessionIndex;
  socket.session = session;

  this.__sessions[sessionIndex] = socket;
  this.trusted[socket.session.id] = sessionIndex;

  this.emit('authentic', {info: info, session: {id: session.id}});

  if (this.securityService.sessionManagementActive()) this.securityService.addActiveSession(session, function(e){
    if (e) return this.log.error('failure adding active session to session control', e);
  }.bind(this));

  //only return what is absolutely necessary

  var loginResponse = {
    id:session.id,
    token:session.token,
    timestamp:session.timestamp,
    info:session.info,
    index:session.index,
    type:session.type
  };

  if (session.user) loginResponse.user = {username:session.user.username, publicKey:session.user.publicKey};
  if (session.secret) loginResponse.secret = session.secret;

  return loginResponse;
};

PubSubService.prototype.detachSession = function (socket) {

  if (this.__sessions[socket.session.index]) {
    delete this.trusted[socket.session.id];
    delete this.__sessions[socket.session.index];
    this.__released_sessions.push(socket.session.index);
  }

  this.emit('disconnect', {info: socket.session.info, session: {id: socket.session.id}});

  if (this.securityService.sessionManagementActive()) this.securityService.removeActiveSession(socket.session, function(e){
    if (e) return this.log.error('failure removing disconnected session from session control', e);
  }.bind(this));
};

PubSubService.prototype.connectLocal = function (handler, session) {
  var _this = this;

  var socket = {
    intraProc: true,
    write: function (message) {
      handler(message);
    },
    end: function () {
      _this.disconnect(this);
    }
  };

  var info = {_local: true, _browser: false};
  _this.attachSession(socket, session, info);

  return session;
};

PubSubService.prototype.disconnect = function (socket) {

  if (socket.session) {
    this.removeListener(socket.session.index, '*');
    this.detachSession(socket);
  }
};

PubSubService.prototype.getAudienceGroup = function (channel, opts) {

  if (channel == '/ALL@*')//listeners subscribed to everything
    return this.__listeners_ONALL;

  if (!opts) {
    // opts is missing in calls from addListener() and removeListener()
    opts = {
      hasWildcard: channel.indexOf('*') > -1,
      targetAction: channel.split('@')[0].replace('/', '')
    }
  }

  if (opts.hasWildcard) return this['__listeners_wildcard_' + opts.targetAction];
  return this['__listeners_' + opts.targetAction];

};

PubSubService.prototype.emitToAudience = function (publication, channel, opts, callback) {

  var _this = this;
  var audienceGroup = this.getAudienceGroup(channel, opts);

  if (audienceGroup[channel] != null && audienceGroup[channel] != undefined) {

    async.eachSeries(audienceGroup[channel], function(sessionId, emitCallback){
      _this.happn.services.protocol.emitMessage(publication, sessionId, emitCallback);
    }, callback);

  } else callback();
};

PubSubService.prototype.publish = function (message, payload) {

  payload._meta.published = true;

  var action = message.action.toUpperCase();
  var messageChannel = '/' + action + '@' + message.path;

  var type = payload._meta.type; //this seems odd, gets reconnected at the end, but it must be emitted as type 'data',
  //then when control is passed back to the response, we need it to be type 'response'
  payload._meta.action = messageChannel;
  payload._meta.type = 'data';
  payload.protocol = message.protocol;

  var opts = {            // 1. to allow shared .serialized between repetitive calls to emitToAudience()
    hasWildcard: false,   // 2. to avert repetitive test for indexOf(*) in getAudienceGroup()
    targetAction: action  // 3. to avert repetitive parsing of channel string to determine action in getAudienceGroup()
  };

  this.emitToAudience(payload, messageChannel, opts);
  opts.targetAction = 'ALL';
  this.emitToAudience(payload, '/ALL@' + message.path, opts);
  this.emitToAudience(payload, '/ALL@*', opts);

  opts.hasWildcard = true; // all remaining emit attempts are to wildcard subscribers

  for (var allPath in this.__listeners_wildcard_ALL) {
    if (this.happn.services.utils.wildcardMatch(allPath.replace('/ALL@/', '/*@/'), messageChannel)) {
      this.emitToAudience(payload, allPath, opts);
    }
  }

  opts.targetAction = action;

  var wildcardActionGroup = this['__listeners_wildcard_' + action];
  for (var actionPath in wildcardActionGroup) {
    if (this.happn.services.utils.wildcardMatch(actionPath, messageChannel)) {
      this.emitToAudience(payload, actionPath, opts);
    }
  }

  payload._meta.type = type;
};

PubSubService.prototype.__notifyClient = function (socket, eventKey, data) {
  socket.write({_meta: {type: 'system'}, eventKey: eventKey, data: data});
};

PubSubService.prototype.__syncSessions = function(){

  var _this = this;

  async.eachSeries(_this.__sessions, function(socket, socketCB){
    _this.securityService.addActiveSession(socket.session, socketCB);
  }, function(e){
    if (e) return _this.log.error('failure syncing sessions with session manager', e);
    else return _this.log.info('sessions synced with session manager');
  });
};

PubSubService.prototype.securityDirectoryChanged = function (whatHappnd, changedData) {

  if (['link-group', 'unlink-group', 'delete-user', 'delete-group'].indexOf(whatHappnd) > -1) {

    try {

      this.__sessions.every(function (socket) {

        if (whatHappnd == 'link-group') {

          if (changedData._meta.path.indexOf('/_SYSTEM/_SECURITY/_USER/' + socket.session.user.username + '/_USER_GROUP/') == 0) {

            var groupName = changedData._meta.path.replace('/_SYSTEM/_SECURITY/_USER/' + socket.session.user.username + '/_USER_GROUP/', '');

            socket.session.user.groups[groupName] = changedData;
            socket.session.permissionSetKey = this.securityService.generatePermissionSetKey(socket.session.user);

            return false;

          }
        }

        if (whatHappnd == 'unlink-group') {

          if (changedData.indexOf('/_SYSTEM/_SECURITY/_USER/' + socket.session.user.username + '/_USER_GROUP/') == 0) {

            var groupName = changedData.replace('/_SYSTEM/_SECURITY/_USER/' + socket.session.user.username + '/_USER_GROUP/', '');
            delete socket.session.user.groups[groupName];

            socket.session.permissionSetKey = this.securityService.generatePermissionSetKey(socket.session.user);

            return false;
          }
        }

        if (whatHappnd == 'delete-user') {

          var userName = changedData.obj._meta.path.replace('/_SYSTEM/_SECURITY/_USER/', '');

          if (socket.session.user.username == userName) {

            this.__notifyClient(socket, 'server-side-disconnect', 'security directory update: user deleted');
            socket.end();

            return false;
          }

        }

        if (whatHappnd == 'delete-group') {

          if (socket.session.user.groups[changedData.obj.name]) {
            delete socket.session.user.groups[changedData.obj.name];
            socket.session.permissionSetKey = _this.securityService.generatePermissionSetKey(socket.session.user);
          }

        }

        return true;

      }.bind(this));

    } catch (e) {
      this.log.error('failure updating security directory', e);
    }
  }

  if (whatHappnd == 'session-management-activated'){
    this.__syncSessions();
  }

  return true;
};
