var Promise = require('bluebird');
var traverse = require('traverse');

module.exports.clone = function(obj, preserveFunctions){

  if (!obj) return obj;

  var cloned = JSON.parse(JSON.stringify(obj));
  var clonedIndex = traverse(cloned);

  if (preserveFunctions){
    //we put the functions back again - if there are any
    traverse(obj).forEach(function (val) {
        if (typeof val == 'function'){
          if (clonedIndex.has(this.path))
            clonedIndex.set(this.path, val);
        }
    });
  }

  return cloned;
}

module.exports.wildcardMatch = function(pattern, matchTo){
  var matchResult = matchTo.match(new RegExp(pattern.replace(/[*]/g,'.*')));

  if (matchResult) return true;
  else return false;
}

module.exports.wildcardAggregate = function(wildcardDict){
  
  var sortedKeys = Object.keys(wildcardDict).sort();

  for (var wcPathIndex in sortedKeys){
    for (var wcPathCompare in  wildcardDict){
      if (sortedKeys[wcPathIndex] != wcPathCompare){
        if (this.wildcardMatch(sortedKeys[wcPathIndex], wcPathCompare))
          delete wildcardDict[wcPathCompare];
      }
    }
  }

  return wildcardDict;
}

module.exports.promisify = function(originalFunction, opts) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    var _this = this;

    if (opts && opts.unshift) args.unshift(opts.unshift);

    // No promisify if last passed arg is function (ie callback)

    if (typeof args[args.length - 1] == 'function') {
      return originalFunction.apply(this, args);
    }

    return new Promise(function(resolve, reject) {
      // push false callback into arguments
      args.push(function(error, result, more) {
        if (error) return reject(error);
        if (more) {
          var args = Array.prototype.slice.call(arguments);
          args.shift(); // toss undefined error
          return resolve(args); // resolve array of args passed to callback
        }
        return resolve(result);
      });
      try {
        return originalFunction.apply(_this, args);
      } catch (error) {
        return reject(error);
      }
    });
  }
}

