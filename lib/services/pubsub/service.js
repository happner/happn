var path = require('path')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , async = require('async')
  , Promise = require('bluebird')
  ;

module.exports = PubSubService;

function PubSubService(opts) {

  this.log = opts.logger.createLogger('PubSub');
  this.log.$$TRACE('construct(%j)', opts);

  this.__listeners_SET = {};
  this.__listeners_REMOVE = {};
  this.__listeners_ALL = {};
  this.__listeners_ONALL = {};
  this.__listeners_wildcard_ALL = {};
  this.__listeners_wildcard_SET = {};
  this.__listeners_wildcard_REMOVE = {};

}

// Enable subscription to key lifecycle events
util.inherits(PubSubService, EventEmitter);

PubSubService.prototype.stats = function (opts) {
  return {
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

    var _this = this;

    if (message.request.action === 'on') {

      _this.addListener(message.request.path, message.session.id, message.request.options);
      return _this.__doSubscriptionCallback(message, callback);

    } else if (message.request.action === 'off') {

      _this.removeListener(message.session.id, message.request.path, message.request.options);

      message.response = {
        data: {},
        _meta: {
          status: 'ok',
          type:'response'
        }
      };

    } else  if (['set', 'remove'].indexOf(message.request.action) > -1) {

      if (!message.request.options || !message.request.options.noPublish) return _this.publish(message.request, message.response, function(e){
        callback(e, message);
      });
    }

    return callback(null, message);

  }catch(e){
    callback(e);
  }
});

PubSubService.prototype.initialize = function (config, callback) {
  var _this = this;

  try {

    if (!config) config = {};

    if (config.timeout) config.timeout = false;

    _this.dataService = _this.happn.services.data;
    _this.securityService = _this.happn.services.security;

    _this.config = config;

  } catch (e) {
    callback(e);
  }

  callback();
};

PubSubService.prototype.__emitInitialValues = function (eventId, channel, sessionId, initialItems, protocol, callback) {

  var _this = this;

  async.eachSeries(initialItems, function(item, itemCallback){

    item._meta.action = channel.toString();
    item._meta.type = 'data';
    item._meta.status = 'ok';
    item._meta.published = false;

    _this.__emitPublication(item, channel, {clone:true, protocol:protocol}, sessionId, itemCallback);

  }, callback);
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
        _this.__emitInitialValues(message.request.eventId, channel, message.session.id, initialItems, message.protocol, function(e){
          if (e) _this.happn.services.error.handleSystem(e, 'pubsub');
        });
      }
    });

  } else doCallback();
};

PubSubService.prototype.addListener = function (channel, sessionId, parameters) {

  var audienceGroup = this.getAudienceGroup(channel);

  if (!audienceGroup[channel]) audienceGroup[channel] = {};

  var refCount = parameters.refCount;

  if (!refCount) refCount = 1;

  if (!audienceGroup[channel][sessionId]) audienceGroup[channel][sessionId] = refCount;
  else audienceGroup[channel][sessionId] += refCount;

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

PubSubService.prototype.getAudienceGroup = function (channel, opts) {

  if (channel == '/ALL@*') return this.__listeners_ONALL; //listeners subscribed to everything

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

PubSubService.prototype.__emitPublication = function (publication, channel, opts, sessionId, callback){

  var _this = this;
  var emitPublication = publication;

  if (opts.clone) emitPublication = _this.happn.services.utils.clone(publication);

  delete emitPublication._meta.status;
  delete emitPublication._meta.published;
  delete emitPublication._meta.eventId;
  delete emitPublication._meta._id;

  publication._meta.channel = channel;
  publication._meta.sessionId = sessionId;
  publication.__outbound = true;

  var message = {
    raw:{
      publication:publication,
      channel:channel,
      opts:opts,
      action:'emit'
    }
  };

  _this.happn.services.session.getSession(sessionId, function(e, session){

    if (e) return callback(e);
    message.session = session;
    _this.happn.services.queue.pushOutbound(message, callback);
  });

};

PubSubService.prototype.clearSubscriptions = function(sessionId){
  this.removeListener(sessionId, '*');
};

PubSubService.prototype.emitToAudience = function (publication, channel, opts, callback) {

  var _this = this;

  var audienceGroup = this.getAudienceGroup(channel, opts);
  var serialized;

  if (!audienceGroup) return callback();

  if (!audienceGroup[channel]) return callback();

  var audienceSessions = Object.keys(audienceGroup[channel]);

  if (audienceSessions.length == 0) return callback();

  async.each(audienceSessions, function(sessionId, emitCallback){

    var decoupledPublication;

    if (opts.deepCopy) return _this.__emitPublication(publication, channel, {clone:true}, sessionId, emitCallback);//we deep clone for intra process comms

    else if (opts.noCopy) return _this.__emitPublication(publication, channel, {clone:false}, sessionId, emitCallback);

    else {
      //necessary because the socket write is non-blocking, this means we have to ensure
      //the packet data is decoupled here, even if the data goes over the wire
      //only JSON can make it over the wire, use JSON, more economical

      if (!serialized) serialized = JSON.stringify(publication);

      // still requires a separate copy per subscriber
      // but only when payload encryption is turned on,
      // for all other cases this step could be shared
      // because the data is cloned by virtue of the fact
      // that it crosses the network
      decoupledPublication = JSON.parse(serialized);
    }
    _this.__emitPublication(decoupledPublication, channel, {clone:false}, sessionId, emitCallback);

  }, callback);

};

PubSubService.prototype.publish = function (request, payload, publishCallback) {

  var _this = this;

  var action = request.action.toUpperCase();
  var messageChannel = '/' + action + '@' + request.path;

  var opts = {            // 1. to allow shared .serialized between repetitive calls to emitToAudience()
    hasWildcard: false,   // 2. to avert repetitive test for indexOf(*) in getAudienceGroup()
    targetAction: action  // 3. to avert repetitive parsing of channel string to determine action in getAudienceGroup()
  };

  var type = payload._meta.type; //this seems odd, gets reconnected at the end, but it must be emitted as type 'data',
  //then when control is passed back to the response, we need it to be type 'response'

  payload._meta.action = messageChannel;
  payload._meta.type = 'data';
  payload.protocol = request.protocol;

  async.series([

    function(callback){

      _this.emitToAudience(payload, messageChannel, opts, callback);
    },

    function(callback){

      opts.targetAction = 'ALL';

      _this.emitToAudience(payload, '/ALL@' + request.path, opts, callback);
    },

    function(callback){

      opts.hasWildcard = true; // all remaining emit attempts are to wildcard subscribers

      async.each(Object.keys(_this.__listeners_wildcard_ALL), function(allPath, wildcardAllCallback){

        if (_this.happn.services.utils.wildcardMatch(allPath.replace('/ALL@/', '/*@/'), messageChannel)) _this.emitToAudience(payload, allPath, opts, wildcardAllCallback);
        else wildcardAllCallback();

      }, callback);
    },

    function(callback){

      opts.targetAction = action;

      async.each(Object.keys(_this['__listeners_wildcard_' + action]), function(actionPath, wildcardAllCallback){

        if (_this.happn.services.utils.wildcardMatch(actionPath, messageChannel)) _this.emitToAudience(payload, actionPath, opts, wildcardAllCallback);
        else wildcardAllCallback();

      }, callback);
    },

    function(callback){
      _this.emitToAudience(payload, '/ALL@*', opts, callback);
    }
  ], function(e){

    payload._meta.type = type;
    payload._meta.published = true;

    publishCallback(e);
  });
};

PubSubService.prototype.__notifyClient = function (socket, eventKey, data) {
  socket.write({_meta: {type: 'system'}, eventKey: eventKey, data: data});
};
