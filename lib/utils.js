module.exports.clone = function(obj){
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
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

