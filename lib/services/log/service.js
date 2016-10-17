

var util = require('util')
  , Promise = require('bluebird')
  , Logger = require('happn-logger')
  ;

module.exports = LogService;

function LogService() {

}

LogService.prototype.processMessage = Promise.promisify(function(message, callback){
  try{

    return callback(null, message);

  }catch(e){
    callback(e);
  }
});

LogService.prototype.stats = function () {
  return this.__stats;
};

LogService.prototype.initialize = function(config, callback){

  this.__stats = {};
  this.__logs = {};
  this.__logs['System'] = this.happn.log;

  callback();
};

LogService.prototype.error = Promise.promisify(function(message, data, area){
  return this.write(message, 'error', data, area);
});

LogService.prototype.info = Promise.promisify(function(message, data, area){
  return this.write(message, 'info', data, area);
});

LogService.prototype.warn = Promise.promisify(function(message, data, area){
  return this.write(message, 'warn', data, area);
});

LogService.prototype.write = Promise.promisify(function(message, type, data, area){

  if (!area) area = 'System';
  if (!type) type = 'info';

  if (!this.__logs[area]) this.__logs[area] = Logger.createLogger(area);

  if (!this.__stats[area]) this.__stats[area] = {};
  if (!this.__stats[area][type]) this.__stats[area][type] = 1;
  else this.__stats[area][type]++;

  this.__logs[area][type](message, data);
});
