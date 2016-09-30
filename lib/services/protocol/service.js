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

ProtocolService.prototype.processMessage = function(message, respond){

  var _this = this;

  if (!message.protocol) message.protocol = 'happn';

  var protocol = this.config.protocols[message.protocol];

  async.waterfall([

    protocol.validate(message),

    protocol.transform.bind(protocol),

    _this.happn.services.security.processMessage.bind(_this.happn.services.security),

    _this.happn.services.system.processMessage.bind(_this.happn.services.system),

    _this.happn.services.data.processMessage.bind(_this.happn.services.data),

    _this.happn.services.pubsub.processMessage.bind(_this.happn.services.pubsub),

    _this.happn.services.log.processMessage.bind(_this.happn.services.log)

  ], function (e) {

    if (e) protocol.fail(e, message).then(respond(e, message));
    else protocol.success(message).then(respond(null, message));
  });

};

ProtocolService.prototype.initialize = Promise.promisify(function (config, callback) {

  if (!config) config = {};

  if (!config.protocols) config.protocols = {};

  var HappnProtocol = require('./protocol-happn');

  if (!config.protocols['happn']) config.protocols['happn'] = new HappnProtocol();

  for (var protocolKey in config.protocols) Object.defineProperty(config.protocols[protocolKey], 'happn', {value:this.happn});

  this.config = config;

  return callback();

});

