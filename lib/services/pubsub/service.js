var Promise = require('bluebird');

module.exports = PubSubService;

function PubSubService(opts) {}

PubSubService.prototype.processMessage = Promise.promisify(function(message, callback){

  console.log('PUBSUB HAPPENING:::', message);

  return callback();
});

PubSubService.prototype.initialize = Promise.promisify(function(config, callback){

  return callback();
});
