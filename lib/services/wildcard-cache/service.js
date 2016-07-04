module.exports = WildcardCache;

// NOTE: There is lots of functionality provided by the lru-cache
//       that is not proxied by this class.

var LRU = require('lru-cache');

function WildcardCache(opts) {
  this.log = opts.logger.createLogger('WildcardCache');
  this.log.$$TRACE('construct(%j)', opts);
}

WildcardCache.prototype.initialize = function(config, callback) {
  this.enabled = config.max ? true : false;
  if (!this.enabled) return callback();
  this.cache = LRU(config);
  callback();
};

WildcardCache.prototype.get = function(key) {
  if (!this.cache) return null;
  return this.cache.get(key);
};

WildcardCache.prototype.set = function(key, value) {
  if (!this.cache) return null;
  return this.cache.set(key, value);
};
