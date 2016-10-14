var EventEmitter = require("events").EventEmitter;
var util = require('util');
var Promise = require('bluebird');
var sift = require('sift');

function StaticCache(opts) {
  this.opts = opts;
  this.__cache = {};
  this.__eventEmitter = new EventEmitter();
  this.__timeouts = {};
}

StaticCache.prototype.__emit = function (key, data) {
  return this.__eventEmitter.emit(key, data);
};

StaticCache.prototype.on = function (key, handler) {
  return this.__eventEmitter.on(key, handler);
};

StaticCache.prototype.off = function (key, handler) {
  return this.__eventEmitter.removeListener(key, handler);
};

StaticCache.prototype.update = Promise.promisify(function(key, data, callback){

  try{

    if (typeof data == 'function'){
      callback = data;
      data = cache;
    }

    if (this.__cache[key]){
      this.__cache[key].data = data;
      return this.__tryCallback(callback, this.__cache[key], null);
    }else this.__tryCallback(callback, null, null);

  }catch(e){
    return this.__tryCallback(callback, null, e);
  }
});

StaticCache.prototype.__tryCallback = function(callback, data, e, clone){

  var callbackData = data;

  if (data && clone) callbackData = this.utilities.clone(data);

  if (e){
    if (callback) return callback(e);
    else throw e;
  }

  if (callback) callback(null, callbackData);
  else return callbackData;

};

StaticCache.prototype.increment = Promise.promisify(function(key, by, callback){

  try{
    if (this.__cache[key] && typeof this.__cache[key].data == 'number') {
      this.__cache[key].data += by;
      return this.__tryCallback(callback, this.__cache[key].data, null, true);
    }
    return this.__tryCallback(callback, null, null);
  }catch(e){
    return this.__tryCallback(callback, null, e);
  }
});

StaticCache.prototype.appendTimeout = function(data, ttl){

  var _this = this;

  _this.clearTimeout(data);

  data.ttl = ttl;

  _this.__timeouts[data.key] = setTimeout(function(){

    var thisKey = this.key;
    _this.remove(this.key, function(e){
      if (e) _this.__emit('error', new Error('failed to remove timed out item'));
      _this.__emit('item-timed-out', {key:thisKey});
    });

  }.bind(data), ttl);

};

StaticCache.prototype.clear = Promise.promisify(function(callback){
  this.__cache = {};

  if (callback) callback();
});

StaticCache.prototype.clearTimeout = function(data){
  if (this.__timeouts[data.key] !== undefined) clearTimeout(this.__timeouts[data.key]);
};

StaticCache.prototype.get = Promise.promisify(function(key, opts, callback){

  var _this = this;

  try{

    if (typeof opts == 'function') {
      callback = opts;
      opts = {};
    }

    if (!opts) opts = {};

    if (!_this.__cache[key]){

      if (opts.retrieveMethod){

        opts.retrieveMethod.call(opts.retrieveMethod, function(e, result){

          if (e) return callback(e);

          // -1 and 0 are perfectly viable things to cache
          if (result == null || result == undefined) return _this.__tryCallback(callback, null, null);

          _this.set(key, result, opts, function(e){
            return _this.__tryCallback(callback, result, e, true);
          });

        });

      } else if (opts.default){

        var value = opts.default.value;
        delete opts.default.value;

        _this.set(key, value, opts.default, function(e){

          return _this.__tryCallback(callback, value, e, true);
        });

      } else return _this.__tryCallback(callback, null, null);

    } else return _this.__tryCallback(callback, this.__cache[key].data, null, true);

  }catch(e){
    return _this.__tryCallback(callback, null, e);
  }
});

StaticCache.prototype.set = Promise.promisify(function(key, data, opts, callback){
  try{

    if (typeof opts == 'function') {
      callback = opts;
      opts = null;
    }

    if (!opts) opts = {};
    if (!opts.ttl) opts.ttl = this.opts.defaultTTL;

    var cacheItem = {data:this.utilities.clone(data), key:key};

    if (opts.ttl > 0) {

      var preExisting = this.__cache[key];

      if (preExisting != null && preExisting != undefined) this.clearTimeout(preExisting);

      this.appendTimeout(cacheItem, opts.ttl);
    }

    this.__cache[key] = cacheItem;

    this.__emit('item-set', cacheItem);

    return this.__tryCallback(callback, cacheItem, null);

  }catch(e){
    return this.__tryCallback(callback, null, e);
  }
});

StaticCache.prototype.__all = Promise.promisify(function(callback){

  try{

    var allItems = [];

    Object.keys(this.__cache).forEach(function(itemKey){
      allItems.push(this.utilities.clone(this.__cache[itemKey].data));
    }.bind(this));

    callback(null, allItems);

  }catch(e){
    callback(e);
  }
});

StaticCache.prototype.all = Promise.promisify(function(filter, callback){

  try{

    if (typeof filter == 'function'){
      callback = filter;
      filter = null;
    }

    this.__all(function(e, items){

      if (e) return callback(e);
      if (filter) return callback(null, sift({$and:[filter]}, items));
      else return callback(null, items);

    });

  }catch(e){
    callback(e);
  }
});

StaticCache.prototype.remove = Promise.promisify(function(key, opts, callback){

  try{

    if (typeof opts == 'function'){
      callback = opts;
      opts = null;
    }

    if (!opts) opts = {};

    var foundItem = false;

    if (this.__cache[key]) {
      foundItem = true;
      //delete the item
      delete this.__cache[key];
    }

    if (foundItem) this.__emit('item-removed', key);

    return this.__tryCallback(callback, foundItem, null);

  }catch(e){
    return this.__tryCallback(callback, null, e);
  }
});

module.exports = StaticCache;
