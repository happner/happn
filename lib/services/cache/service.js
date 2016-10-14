var shortid = require('shortid');
var uuid = require('node-uuid');
var EventEmitter = require("events").EventEmitter;
var util = require('util');

var StaticCache = require('./cache_static');
var LRUCache = require('./cache_lru');
var PersistedCache = require('./cache_persist');
var Promise = require('bluebird');
var sift = require('sift');

module.exports = CacheService;

function CacheService(opts) {

  var Logger;

  if (opts && opts.logger) {
    Logger = opts.logger.createLogger('Cache');
  } else {
    Logger = require('happn-logger');
    Logger.configure({logLevel: 'info'});
  }

  this.__eventEmitter = new EventEmitter();

  this.log = Logger.createLogger('Cache');
  this.log.$$TRACE('construct(%j)', opts);

  this.__cache = {};

}

CacheService.prototype.__emit = function (key, data) {
  return this.__eventEmitter.emit(key, data);
};

CacheService.prototype.on = function (key, handler) {
  return this.__eventEmitter.on(key, handler);
};

CacheService.prototype.off = function (key, handler) {
  return this.__eventEmitter.removeListener(key, handler);
};

CacheService.prototype.initialize = function (config, callback) {

  try{

    if (typeof config == 'function'){
      callback = config;
      config = {};
    }

    if (!config) config = {};
    if (!config.defaultTTL) config.defaultTTL = 0;//one minute
    if (!config.defaultCacheName) config.defaultCacheName = 'default';//one minute

    if (!config.defaultCacheOpts) config.defaultCacheOpts = { type:'static', cache:{} };

    this.config = config;
    this.__caches = {};
    this.__defaultCache = this.new(config.defaultCacheName, config.defaultCacheOpts);

    callback();

  }catch(e){
    callback(e);
  }
};

CacheService.prototype.stop = function(opts, callback){
  if (typeof opts == 'function') callback = opts;
  callback();
};

CacheService.prototype.new = function(name, opts){

  if (!name) throw new Error('all caches must have a name');

  if (typeof opts == 'function') opts = null;

  if (!opts) opts = this.config.defaultCacheOpts;
  if (!opts.type) opts.type = 'static';

  if (!opts.cache) opts.cache = {};

  if (this.__caches[name] && !opts.overwrite) throw new Error('a cache by this name already exists');

  if (opts.type.toLowerCase() == 'lru') this.__caches[name] = new LRUCache(opts.cache);
  else if (opts.type.toLowerCase() == 'persist') {
    opts.cache.key_prefix = name;
    this.__caches[name] = new PersistedCache(opts.cache);
  }
  else this.__caches[name] = new StaticCache(opts.cache);

  var _this = this;

  Object.defineProperty(this.__caches[name], 'utilities', {value:_this.happn.services.utils});

  this.__caches[name].on('error', function(e){
    _this.__emit('error', {cache:this.cache, error:e});
  }.bind({cache:name}));

  this.__caches[name].on('item-timed-out', function(item){
    _this.__emit('item-timed-out', {cache:this.cache, item:item});
  }.bind({cache:name}));

  this.__caches[name].on('item-set', function(item){
    _this.__emit('item-set', {cache:this.cache, item:item});
  }.bind({cache:name}));

  this.__caches[name].on('item-removed', function(item){
    _this.__emit('item-removed', {cache:this.cache, item:item});
  }.bind({cache:name}));

  return this.__caches[name];
};

CacheService.prototype.remove = function(itemKey, opts, callback){
    this.__defaultCache.remove(itemKey, opts, callback);
};

CacheService.prototype.clear = function(cache, callback){

  try{

    var cacheToClear;

    if (cache){

      if (cache == this.config.defaultCacheName){
        cacheToClear = this.__defaultCache;
      }else{
        cacheToClear = this.__caches[cache];
      }

    }else cacheToClear = this.__defaultCache;

    if (cacheToClear){

      if (callback){

        return cacheToClear.clear(function(e){

          if (e) return callback(e);
          delete this.__caches[cache];
          this.__emit('cache-cleared', cache);
          callback();

        }.bind(this));
      }

      cacheToClear.clear();
      delete this.__caches[cache];
      this.__emit('cache-cleared', cache);
    }

    if (callback) callback();

  }catch(e){

    if (callback) callback(e);
    else throw e;
  }
};

CacheService.prototype.update = Promise.promisify(function(itemKey, data, callback){
  return this.__defaultCache.update(itemKey, data, callback);
});

CacheService.prototype.increment = Promise.promisify(function(itemKey, by, callback){

  if (typeof by == 'function'){
    callback = by;
    by = 1;
  }

  return this.__defaultCache.increment(itemKey, by, callback);
});

CacheService.prototype.set = Promise.promisify(function(itemKey, data, opts, callback){

  if (typeof opts == 'function'){
    callback = opts;
    opts = {};
  }

  return this.__defaultCache.set(itemKey, data, opts, callback);
});

CacheService.prototype.get = Promise.promisify(function(itemKey, opts, callback){

  if (typeof opts == 'function'){
    callback = opts;
    opts = {};
  }

  return this.__defaultCache.get(itemKey, opts, callback);
});

CacheService.prototype.filterCacheItems = function(filter, items){

  if (!filter) return callback(this.happn.services.error.SystemError('filter is missing'));

  return sift({$and:[filter]}, items);
};

CacheService.prototype.filterCache = function(filter, cache, callback){

  var _this = this;

  if (!filter) return callback(_this.happn.services.error.SystemError('filter is missing'));

  cache.all(function(e, allItems){

    if (e) return callback(e);

    try{
      return callback(null, _this.filterCacheItems(allItems));
    }catch(e){
      return callback(e);
    }
  });

};


