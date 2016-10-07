var Promise = require('bluebird')
  , deepCopy = require('deep-copy')
  , traverse = require('traverse')
  , ms = require('ms')
  , util = require('util')
;

module.exports = UtilsService;

function UtilsService(){}

UtilsService.prototype.clone = function (obj, circular) {

  if (!obj) return obj;

  if (typeof obj == 'string')
    return obj.toString();

  if (!circular)
    return JSON.parse(JSON.stringify(obj));
  else
    return deepCopy(obj);

};

//NB: this must also change in ./client/base.js
UtilsService.prototype.wildcardMatch = function (pattern, matchTo) {

  var regex = new RegExp(pattern.replace(/[*]/g, '.*'));
  var matchResult = matchTo.match(regex);

  if (matchResult) return true;
  return false;
};

UtilsService.prototype.wildcardAggregate = function (wildcardDict) {

  var sortedKeys = Object.keys(wildcardDict).sort();

  for (var wcPathIndex in sortedKeys) {
    for (var wcPathCompare in  wildcardDict) {
      if (sortedKeys[wcPathIndex] != wcPathCompare) {
        if (this.wildcardMatch(sortedKeys[wcPathIndex], wcPathCompare))
          delete wildcardDict[wcPathCompare];
      }
    }
  }

  return wildcardDict;
};

UtilsService.prototype.isNumeric = function(n){
  return !isNaN(parseFloat(n)) && isFinite(n);
};

UtilsService.prototype.toMilliseconds = function(input){
  if (!input || input == Infinity) return input;
  if (this.isNumeric(input)) return input;
  else return ms(input);
};

UtilsService.prototype.stringContainsAny = function(str, segments, caseInSensitive){
  var containsAny = false;

  segments.every(function(segment){

    var compareSegment = segment;
    var compareStr = str;

    if (caseInSensitive){
      compareSegment = segment.toUpperCase();
      compareStr = str.toUpperCase();
    }

    if (compareStr.indexOf(compareSegment) > -1) {
      containsAny = true;
      return false;
    } else return true;
  });

  return containsAny;
};

UtilsService.prototype.stringifyError = function(err) {
  var plainError = {};
  Object.getOwnPropertyNames(err).forEach(function(key) {
    plainError[key] = err[key];
  });
  return JSON.stringify(plainError);
};

UtilsService.prototype.getFirstMatchingProperty = function(properties, obj){

  var checkProperties = [];

  properties.map(function(propertyName){
    checkProperties.push(propertyName.toLowerCase());
  });

  for (var propertyName in obj) if (checkProperties.indexOf(propertyName.toLowerCase()) > -1) return obj[propertyName];
  return null;
};

UtilsService.prototype.promisify = function (originalFunction, opts) {

  return function () {
    var args = Array.prototype.slice.call(arguments);
    var _this = this;

    if (opts && opts.unshift) args.unshift(opts.unshift);

    // No promisify if last passed arg is function (ie callback)

    if (typeof args[args.length - 1] == 'function') {
      return originalFunction.apply(this, args);
    }

    return new Promise(function (resolve, reject) {
      // push false callback into arguments
      args.push(function (error, result, more) {
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
};

