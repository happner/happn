module.exports = StatsService;

function StatsService(){}

//how we collect stats from the various services and return them as a json object
StatsService.prototype.fetch = function (opts) {

  var stats = {};

  if (!opts) opts = {};

  for (var serviceName in this.happn.services) {
    stats[serviceName] = {};
    if (this.happn.services[serviceName].stats) stats[serviceName] = this.happn.services[serviceName].stats(opts[serviceName]);
  }

  return stats;
};
