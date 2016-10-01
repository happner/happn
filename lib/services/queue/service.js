var util = require('util')
  , EventEmitter = require('events').EventEmitter
  , Promise = require('bluebird')
  , async = require('async')
  ;

module.exports = QueueService;

function QueueService(opts) {

  if (!opts) opts = {};

  this.log = opts.logger.createLogger('Queue');
  this.log.$$TRACE('construct(%j)', opts);

  EventEmitter.call(this);

}

util.inherits(QueueService, EventEmitter);

QueueService.prototype.stats = function () {
  return {
    queued: this.__queue.length
  }
};

QueueService.prototype.inboundDrain = function () {
  this.emit('inbound-queue-empty');
};

QueueService.prototype.inboundSequentialDrain = function () {
  this.emit('inbound-sequential-queue-empty');
};

QueueService.prototype.outboundDrain = function () {
  this.emit('outbound-queue-empty');
};

QueueService.prototype.outboundSequentialDrain = function () {
  this.emit('outbound-sequential-queue-empty');
};

QueueService.prototype.stop = Promise.promisify(function (options, callback) {
  callback();
});

QueueService.prototype.initialize = Promise.promisify(function (config, callback) {

  if (!config) config = {};

  this.config = config;

  if (!this.config.concurrency) this.config.concurrency = Infinity;

  this.__inboundQueue = async.queue(this.happn.services.protocol.processMessageIn.bind(this.happn.services.protocol), this.config.concurrency);
  this.__inboundSequentialQueue = async.queue(this.happn.services.protocol.processMessageIn.bind(this.happn.services.protocol), 1);

  this.__outboundQueue = async.queue(this.happn.services.protocol.processMessageOut.bind(this.happn.services.protocol), this.config.concurrency);
  this.__outboundSequentialQueue = async.queue(this.happn.services.protocol.processMessageOut.bind(this.happn.services.protocol), 1);

  this.__inboundQueue.drain = this.inboundDrain.bind(this);
  this.__inboundSequentialQueue.drain = this.inboundSequentialDrain.bind(this);

  this.__outboundQueue.drain = this.outboundDrain.bind(this);
  this.__outboundSequentialQueue.drain = this.outboundSequentialDrain.bind(this);

  return callback();

});

QueueService.prototype.pushInbound = Promise.promisify(function(message, callback){

  if (message.options && message.options.sequential) {
    this.__inboundSequentialQueue.push(message, callback);
    this.emit('inbound-sequential-job-queued', message);
  }
  else{
    this.__inboundQueue.push(message, callback);
    this.emit('inbound-job-queued', message);
  }
});

QueueService.prototype.pushOutbound = Promise.promisify(function(message, callback){

  if (message.options && message.options.sequential) {
    this.__outboundSequentialQueue.push(message, callback);
    this.emit('outbound-sequential-job-queued', message);
  }
  else{
    this.__outboundQueue.push(message, callback);
    this.emit('outbound-job-queued', message);
  }
});

