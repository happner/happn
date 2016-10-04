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
    protocols:Object.keys(config.protocols),
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

    _this.happn.services.log.processMessageIn.bind(_this.happn.services.log),

    protocol.validate.bind(protocol),

    protocol.transform.bind(protocol),

    _this.happn.services.security.processMessage.bind(_this.happn.services.security),

    _this.happn.services.system.processMessage.bind(_this.happn.services.system),

    _this.happn.services.data.processMessage.bind(_this.happn.services.data),

    _this.happn.services.pubsub.processMessage.bind(_this.happn.services.pubsub),

    _this.happn.services.log.processMessageOut.bind(_this.happn.services.log)

  ], function (e) {

    if (e) protocol.fail(e, message).then(respond(null, message)).catch(respond);
    else protocol.success(message).then(respond(null, message)).catch(respond);
  });

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

    _this.happn.services.log.processMessageIn.bind(_this.happn.services.log),

    protocol.validate.bind(protocol),

    _this.happn.services.security.processMessage.bind(_this.happn.services.security),

    protocol.transform.bind(protocol),

    protocol.emit.bind(protocol),

    _this.happn.services.log.processMessageOut.bind(_this.happn.services.log)

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

  for (var protocolKey in config.protocols) Object.defineProperty(config.protocols[protocolKey], 'happn', {value:this.happn});

  this.config = config;

  return callback();

});

