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

}

// Enable subscription to key lifecycle events
util.inherits(ProtocolService, EventEmitter);

ProtocolService.prototype.stats = function () {
  return {
    protocols:Object.keys(this.config.protocols),
    protocolCounts:this.__protocolStats
  }
};

ProtocolService.prototype.__prepareJob = function(message){

  if (!message.raw.protocol) message.raw.protocol = 'happn';
  if (!message.raw.options) message.raw.options = {};

  return function(callback){
    callback(null, message);
  };
};

ProtocolService.prototype.emitMessage = function(message, sessionId, callback){
  var protocol = this.config.protocols[message.protocol];
  return protocol.emit(message, sessionId, callback);
};

ProtocolService.prototype.processMessageIn = function(message, respond){

  var _this = this;

  var startJob = _this.__prepareJob(message);

  var protocol = _this.config.protocols[message.protocol];

  if (!protocol) {
    //try and match any happn protocol to the latest
    if (message.protocol.indexOf('happn') == 0) protocol = _this.__latest;
    else return _this.happn.services.error.handleSystem('unknown inbound protocol: ' + message.protocol, 'protocol');
  }

  async.waterfall([

    startJob,

    _this.happn.services.layer.log,

    protocol.validateIn,

    protocol.transformIn,

    _this.happn.services.layer.security,

    _this.happn.services.layer.system,

    _this.happn.services.layer.data,

    _this.happn.services.layer.pubsub

  ], function (e) {

    if (e) protocol.fail(e, message).then(respond(null, message)).catch(respond);
    else protocol.success(message).then(respond(null, message)).catch(respond);
  });

};

var cachedProtocol;
ProtocolService.prototype.current = function(){
  if (!cachedProtocol) cachedProtocol = 'happn_' + this.happn.services.system.package.protocol;
  return cachedProtocol;
};

ProtocolService.prototype.processMessageOut = function(message, respond){

  var _this = this;

  var startJob = _this.__prepareJob(message);

  var client = _this.happn.services.session.getClient(message.sessionId);

  if (!client) return _this.happn.services.error.handleSystem('missing client for message emit', 'protocol');

  var protocol = _this.config.protocols[client.sessionProtocol];

  if (!protocol) {
    //try and match any happn protocol to the latest
    if (client.sessionProtocol.indexOf('happn') == 0) protocol = _this.__latest;
    else return _this.happn.services.error.handleSystem('unknown inbound protocol: ' + client.sessionProtocol, 'protocol');
  }

  async.waterfall([

    startJob,

    protocol.validateOut,

    _this.happn.services.layer.security,

    protocol.transformOut,

    protocol.emit,

    _this.happn.services.layer.log

  ], function (e) {

    if (e) protocol.fail(e, message).then(respond(null, message)).catch(respond);
    else protocol.success(message).then(respond(null, message)).catch(respond);
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
    protocol.emit = protocol.emit.bind(protocol);
    protocol.fail = protocol.fail.bind(protocol);
    protocol.success = protocol.success.bind(protocol);

  }

  this.config = config;

  return callback();

});

