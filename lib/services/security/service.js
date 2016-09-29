var Promise = require('bluebird');
module.exports = SecurityService;

function SecurityService(opts) {

}

SecurityService.prototype.processMessage = Promise.promisify(function(message, callback){
  console.log('AUTH HAPPENENING:::');
  return callback();
});

SecurityService.prototype.initialize = Promise.promisify(function(config, callback){

  if (config.secure) this.authorize = function(message, cb){cb();};

  return callback();
});


