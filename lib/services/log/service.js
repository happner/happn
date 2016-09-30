

var util = require('util')
  , Promise = require('bluebird')
  , Logger = require('happn-logger')
  ;

module.exports = LogService;

function LogService() {

}

LogService.prototype.processMessageIn = Promise.promisify(function(message, callback){
  try{

    console.log('LOG HAPPENENING:::');
    return callback(null, message);

  }catch(e){
    callback(e);
  }
});

LogService.prototype.processMessageOut = Promise.promisify(function(message, callback){
  try{

    console.log('LOG OUT HAPPENENING:::');
    return callback(null, message);

  }catch(e){
    callback(e);
  }
});

LogService.prototype.stats = function () {
  return {

  }
};

LogService.prototype.initialize = function(config, callback){

  this.__logs = {};
  this.__logs['System'] = this.happn.log;

  callback();
};

LogService.prototype.log = Promise.promisify(function(message, type, data, area){

  if (!area) area = 'System';
  if (!type) type = 'info';

  if (this.__logs[area]) this.__logs[area] = Logger.createLogger(area);

  this.__logs[area][type](message, data);
});
