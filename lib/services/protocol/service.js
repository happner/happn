var util = require('util')
  , EventEmitter = require('events').EventEmitter
  , Promise = require('bluebird')
  , async = require('async')
  ;

module.exports = ProtocolService;

function ProtocolService(opts) {

  if (!opts) opts = {};

  this.log = opts.logger.createLogger('Protocol');
  this.log.$$TRACE('construct(%j)', opts);

  this.__protocolStats = {};
  this.__stackCache = {};

  this.__benchmarkStats = {};

}

// Enable subscription to key lifecycle events
util.inherits(ProtocolService, EventEmitter);

ProtocolService.prototype.stats = function () {
  return {
    protocols:Object.keys(this.config.protocols),
    protocolCounts:this.__protocolStats,
    benchmarks:this.__benchmarkStats
  }
};

ProtocolService.prototype.emitMessage = function(message, sessionId, callback){
  var protocol = this.config.protocols[message.protocol];
  return protocol.emit(message, sessionId, callback);
};

ProtocolService.prototype.processSystem = function(message, respond){

  var _this = this;

  var protocol = _this.config.protocols[message.session.protocol];//happn by default

  if (!protocol) return respond(_this.happn.services.error.SystemError('unknown system protocol: ' + message.session.protocol, 'protocol'));

  async.waterfall([

    _this.happn.services.layer.begin(message),

    _this.happn.services.layer.log,

    protocol.transformSystem

  ], respond);
};

ProtocolService.prototype.respondMessageIn = function(protocol, message, respond, e){

  if (e) protocol.fail(e, message)
    .then(respond(null, message))
    .catch(this.happn.services.error.handleSystem.bind(this.happn.services.error));

  else protocol.success(message)
    .then(respond(null, message))
    .catch(this.happn.services.error.handleSystem.bind(this.happn.services.error));
};

ProtocolService.prototype.benchmarkStart = function(message, callback){

  if (!this.__benchmarkStats[message.request.action]) this.__benchmarkStats[message.request.action] = {current:{}, count:0, totalTime:0, avg:0};

  this.__benchmarkStats[message.request.action].current[message.id] = Date.now();

  this.__benchmarkStats[message.request.action].count++;

  callback(null, message);

};

ProtocolService.prototype.benchmarkEnd = function(message, callback){

  var stat = this.__benchmarkStats[message.request.action];

  var timespan = Date.now() - stat.current[message.id];

  delete stat.current[message.id];

  stat.totalTime += timespan;

  stat.avg = stat.totalTime / stat.count;

  callback(null, message);

};

ProtocolService.prototype.getInboundStack = function(transformed){

  var stack = [this.happn.services.layer.begin(transformed)];

  if (!this.__stackCache[transformed.request.action]){

    var cachedStack = [];

    if (this.config.benchMarkEnabled) cachedStack.push(this.benchmarkStart.bind(this));

    if (this.config.loggingEnabled) cachedStack.push(this.happn.services.layer.log);
    if (this.config.secure) cachedStack.push(this.happn.services.layer.security.in);

    if (['set','remove'].indexOf(transformed.request.action) > -1){

      cachedStack.push(this.happn.services.layer.data);
      cachedStack.push(this.happn.services.layer.pubsub);
    }

    else if (transformed.request.action === 'get'){

      cachedStack.push(this.happn.services.layer.data);
    }

    else if (['on', 'off'].indexOf(transformed.request.action) > -1){

      cachedStack.push(this.happn.services.layer.pubsub);
    }

    else if (transformed.request.action === 'describe'){

      cachedStack.push(this.happn.services.layer.system);
    }

    else if (transformed.request.action === 'login'){

      cachedStack.push(this.happn.services.layer.security.in);
    }

    if (this.config.benchMarkEnabled) cachedStack.push(this.benchmarkEnd.bind(this));

    this.__stackCache[transformed.request.action] = cachedStack;
  }

  stack.push.apply(stack, this.__stackCache[transformed.request.action]);

  return stack;
};

ProtocolService.prototype.processMessageIn = function(message, callback){

  var _this = this;

  var protocol = _this.config.protocols[message.session.protocol];//happn by default

  if (!protocol) return respond(_this.happn.services.error.SystemError('unknown inbound protocol: ' + message.session.protocol, 'protocol'));

  protocol.validateIn(message, function(e){

    if (e) return _this.respondMessageIn(protocol, message, callback, e);

    protocol.transformIn(message, function(e, transformed){

      if (e) return _this.respondMessageIn(protocol, message, callback, e);

      return async.waterfall(

        _this.getInboundStack(transformed),

        function (e) {
        _this.respondMessageIn(protocol, transformed, callback, e);
        }
      );
    });
  });
};

var cachedProtocol;

ProtocolService.prototype.current = function(){

  if (!cachedProtocol) cachedProtocol = 'happn_' + this.happn.services.system.package.protocol;

  return cachedProtocol;
};

ProtocolService.prototype.getOutboundStack = function(transformed){

  var stack = [this.happn.services.layer.begin(transformed)];

  if (!this.__stackCache['system:outbound']){

    var cachedStack = [];

    if (this.config.secure) cachedStack.push(this.happn.services.layer.security.out);
    if (this.config.loggingEnabled) cachedStack.push(this.happn.services.layer.log);

    this.__stackCache[transformed.request.action] = cachedStack;
  }

  stack.push.apply(stack, this.__stackCache['system:outbound']);

  return stack;
};

ProtocolService.prototype.processMessageOut = function(message, respond){

  var _this = this;

  var protocol = _this.config.protocols[message.session.protocol];//happn by default

  if (!protocol) return respond(_this.happn.services.error.SystemError('unknown inbound protocol: ' + message.session.protocol, 'protocol'));

  protocol.validateOut(message, function(e){

    if (e) return respond(e);

    protocol.transformOut(message, function(e, transformed){

      if (e) return respond(e);

      return async.waterfall(

        _this.getOutboundStack(transformed),

        function (e, publication) {
          if (e) return respond(e);
          protocol.emit(publication, message.session, respond);
        }
      );
    });
  });
};

ProtocolService.prototype.initialize = Promise.promisify(function (config, callback) {

  if (!config) config = {};

  if (!config.protocols) config.protocols = {};

  HappnProtocol = require('./happn_' + require('../../../package.json').protocol);

  this.__latest = new HappnProtocol();

  config.protocols['happn_' + require('../../../package.json').protocol] = this.__latest;

  for (var protocolKey in config.protocols) {

    var protocol = config.protocols[protocolKey];

    Object.defineProperty(protocol, 'happn', {value:this.happn});

    //waterfall messes with "this" - this makes the code cleaner
    protocol.validateIn = protocol.validateIn.bind(protocol);
    protocol.validateOut = protocol.validateOut.bind(protocol);
    protocol.transformIn = protocol.transformIn.bind(protocol);
    protocol.transformOut = protocol.transformOut.bind(protocol);
    protocol.transformSystem = protocol.transformSystem.bind(protocol);
    protocol.emit = protocol.emit.bind(protocol);
    protocol.fail = protocol.fail.bind(protocol);
    protocol.success = protocol.success.bind(protocol);

  }

  this.config = config;

  return callback();

});

