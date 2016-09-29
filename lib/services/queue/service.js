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

QueueService.prototype.drain = function () {
  this.emit('queue-empty');
};

QueueService.prototype.sequentialDrain = function () {
  this.emit('sequential-queue-empty');
};

QueueService.prototype.stop = Promise.promisify(function (options, callback) {
  callback();
});

QueueService.prototype.initialize = Promise.promisify(function (config, callback) {

  if (!config) config = {};

  this.config = config;

  if (!this.config.concurrency) this.config.concurrency = Infinity;

  this.__queue = async.queue(this.happn.services.protocol.processMessage.bind(this.happn.services.protocol), this.config.concurrency);
  this.__sequentialQueue = async.queue(this.happn.services.protocol.processMessage.bind(this.happn.services.protocol), 1);

  this.__queue.drain = this.drain.bind(this);
  this.__sequentialQueue.drain = this.sequentialDrain.bind(this);

  return callback();

});

QueueService.prototype.push = Promise.promisify(function(message, callback){

  if (message.options && message.options.sequential) this.__sequentialQueue.push(message, callback);
  else this.__queue.push(message, callback);

  this.emit('job-queued', message);
});

