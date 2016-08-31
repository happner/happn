var shortid = require('shortid');
var uuid = require('node-uuid');

module.exports = CacheService;

function CacheService(opts) {

  var Logger;

  if (opts && opts.logger) {
    Logger = opts.logger.createLogger('Cache');
  } else {
    Logger = require('happn-logger');
    Logger.configure({logLevel: 'info'});
  }

  this.log = Logger.createLogger('Cache');
  this.log.$$TRACE('construct(%j)', opts);

}

CacheService.prototype.initialize = function (config, callback) {

  if (typeof config == 'function'){
    callback = config;
    config = {};
  }

  if (!config) config = {};
  if (!config.defaultTTL) config.defaultTTL = 0;//one minute
  if (!config.defaultCache) config.defaultCache = 'default';//one minute

  this.config = config;
  this.__cache = {};

  callback();
};

CacheService.prototype.stop = function(opts, callback){
  if (typeof opts == 'function') callback = opts;
  callback();
};

CacheService.prototype.appendTimeout = function(data, ttl){

  var _this = this;

  data.ttl = setTimeout(function(){

    _this.remove(data.key, data.cache);

  }.bind(data), ttl);
};

CacheService.prototype.clearTimeout = function(data){
  if (data.ttl) clearTimeout(data.ttl);
};

CacheService.prototype.remove = function(itemKey, opts, callback){

  try{

    if (typeof opts == 'function'){
      callback = opts;
      opts = null;
    }

    if (!opts) opts = {};

    if (!opts.cache) opts.cache = this.config.defaultCache;

    var foundItem = false;

    if (this.__cache[opts.cache] && this.__cache[opts.cache][itemKey]) {

      foundItem = true;
      //delete the item
      delete this.__cache[opts.cache][itemKey];
      if (opts.cache != this.config.defaultCache && Object.keys(this.__cache[opts.cache]).length == 0) this.clear(opts.cache);

    }

    callback(null, foundItem);

  }catch(e){
    callback(e);
  }

};

CacheService.prototype.clear = function(cache, callback){

  try{
    if (this.__cache[cache]) delete this.__cache[cache];
  }catch(e){
    callback(e);
  }
};

CacheService.prototype.set = function(itemKey, data, opts, callback){

   try{

    if (typeof opts == 'function') {
      callback = opts;
      opts = null;
    }

    if (!opts) opts = {};
    if (!opts.ttl) opts.ttl = this.config.defaultTTL;
    if (!opts.cache) opts.cache = this.config.defaultCache;

    if (!this.__cache[opts.cache]) this.__cache[opts.cache] = {};

    var cacheItem = {data:data, key:itemKey, cache:opts.cache};

    if (opts.ttl > 0) {

      var preExisting = this.__cache[opts.cache][itemKey];

      if (preExisting !== null) this.clearTimeout(preExisting);

      this.appendTimeout(cacheItem, opts.ttl);
    }

    this.__cache[opts.cache][itemKey] = cacheItem;

    callback(null, cacheItem);

  }catch(e){

    callback(e);
  }
};

CacheService.prototype.get = function(itemKey, opts, callback){

  var _this = this;

  try{

    if (typeof opts == 'function') {
      callback = opts;
      opts = {};
    }

    if (!opts) opts = {};
    if (!opts.cache) opts.cache = _this.config.defaultCache;

    if (!_this.__cache[opts.cache] || !_this.__cache[opts.cache][itemKey]){

      if (opts.retrieveMethod){

        opts.retrieveMethod.call(opts.retrieveMethod, function(e, result){

          if (e) return callback(e);

          if (!result) return callback(null, null);

          _this.set(itemKey, result, opts, function(e){

            if (e) return callback(e);
            else return callback(null, result);

          });

        });

      } else return callback(null, null);

    } else  callback(null, this.__cache[opts.cache][itemKey].data);

  }catch(e){
    callback(e);
  }

};


