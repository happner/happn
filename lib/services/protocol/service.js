var util = require('util')
  , EventEmitter = require('events').EventEmitter
  , Promise = require('bluebird')
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

ProtocolService.prototype.processMessage = function(message, callback){

  var _this = this;

  if (!message.protocol) message.protocol = 'happn';

  var protocol = this.config.protocols[message.protocol];

  protocol

    .validate(message.request)

    .then(protocol.transform(message))

    .then(_this.happn.services.security.processMessage(message))

    .then(_this.happn.services.system.processMessage(message))

    .then(_this.happn.services.data.processMessage(message))

    .then(_this.happn.services.pubsub.processMessage(message))

    .then(protocol.success(message, callback))

    .catch(function(e){
      protocol.fail(e, message, callback)
    });

};

ProtocolService.prototype.initialize = Promise.promisify(function (config, callback) {

  if (!config) config = {};

  if (!config.protocols) config.protocols = {};

  var HappnProtocol = require('./protocol-happn');

  if (!config.protocols['happn']) config.protocols['happn'] = new HappnProtocol();

  for (var protocolKey in config.protocols) Object.defineProperty(config.protocols[protocolKey], 'happn', this.happn);

  this.config = config;

  return callback();

});

