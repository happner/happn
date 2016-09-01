var EventEmitter = require("events").EventEmitter;
var LRU = require("lru-cache");
var utilities = require('../../utils');
var util = require('util');

function LRUCache(opts) {
  this.__cache = LRU(opts);
  this.__eventEmitter = new EventEmitter();
}

LRUCache.prototype.__emit = function (key, data) {
  return this.__eventEmitter.emit(key, data);
};

LRUCache.prototype.on = function (key, handler) {
  return this.__eventEmitter.on(key, handler);
};

LRUCache.prototype.off = function (key, handler) {
  return this.__eventEmitter.removeListener(key, handler);
};

LRUCache.prototype.__tryCallback = function(callback, data, e, clone){

  var callbackData = data;

  if (data && clone) callbackData = utilities.clone(data);

  if (e){
    if (callback) return callback(e);
    else throw e;
  }

  if (callback) callback(null, callbackData);
  else return callbackData;

};


LRUCache.get = function(key, opts, callback){

  try{

    if (key == null || key == undefined) return callback(new Error('invalid key'));

    if (typeof opts == 'function'){
      callback = opts;
      opts = null;
    }

    return this.__tryCallback(callback, this.__cache.get(key), null, true);

  }catch(e){
    this.__tryCallback(callback, null, e)
  }
};

LRUCache.set = function(key, data, opts, callback){
  try{

    if (key == null || key == undefined) return callback(new Error('invalid key'));

    if (typeof opts == 'function'){
      callback = opts;
      opts = null;
    }

    if (!opts) opts = {};

    var maxAge = undefined;
    if (opts.maxAge) maxAge = opts.maxAge;

    this.__cache.set(key, utilities.clone(data), maxAge);

    callback(null);

  }catch(e){
    callback(e);
  }
};

LRUCache.remove = function(key, opts, callback){
  try{

    if (key == null || key == undefined) return callback(new Error('invalid key'));

    if (typeof opts == 'function'){
      callback = opts;
      opts = null;
    }

    this.__cache.del(key);

    callback(null);

  }catch(e){
    callback(e);
  }
};

module.exports = LRUCache;
