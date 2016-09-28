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

ProtocolService.prototype.process = function(message, callback){

  var _this = this;

  if (!message.protocol) message.protocol = 'happn';

  var protocol = this.config.protocols[message.protocol];

  protocol

    .validate(message)

    .then(protocol.transform(message))

    .then(_this.happn.Services.security.authorize(message))

    .then(_this.happn.Services.data.persist(message))

    .then(_this.happn.Services.pubsub.process(message))

    .then(protocol.success(message, callback))

    .catch(function(e){
      protocol.fail(e, callback)
    });

};

ProtocolService.prototype.initialize = Promise.promisify(function (config, callback) {

  if (!config) config = {};

  if (!config.protocols) config.protocols = {};

  if (!config.protocols['happn']) config.protocols['happn'] = require('./protocol-happn');

  for (var protocolKey in config.protocols) Object.defineProperty(config.protocols[protocolKey], 'happn', this.happn);

  this.config = config;

  return callback();

});

