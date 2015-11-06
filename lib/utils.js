var logger, log, config, previous;
var log4js = require('log4js');
var levels = ['trace','debug','info','warn','error','fatal'];
var guard = {
  trace: 'isTraceEnabled',
  debug: 'isDebugEnabled',
  info:  'isInfoEnabled',
  warn:  'isWarnEnabled',
  error: 'isErrorEnabled',
  fatal: 'isFatalEnabled',
};

module.exports.initialize = function(conf) {

  if (conf.Logger) {
    module.exports.log = (typeof UTILITIES == 'object') ? UTILITIES.log : function() {};
    module.exports.createLogger = conf.Logger.createLogger;
    return;
  }

  var logLayout, fileAppender;

  config = conf || {};

  if (!config.logger) {

    if (config.logDateFormat && !config.logLayout) {
      // assemble default layout with date format
      config.logLayout = {
        type: 'pattern',
        pattern: '%d{'+config.logDateFormat+'} [%5.5p] - %m'
      };
    }

    if (process.stdout.isTTY) {
      // to console, no date in log
      logLayout = logLayout || config.logLayout || {
        type: 'pattern',
        pattern: '[%[%5.5p%]] - %m'
      };
    }
    
    else {
      // piped to file, display date, no colour
      config.logDateFormat = config.logDateFormat || 'yyyy-MM-dd hh:mm:ss';
      logLayout = logLayout || config.logLayout || {
        type: 'pattern',
        pattern: '%d{'+config.logDateFormat+'} [%5.5p] - %m'
      };
    }

    config.logger = config.logger || {
      appenders: [{
        type: "console",
        layout: typeof logLayout == 'object' ? logLayout : {
          type: 'pattern',
          pattern: logLayout
        }
      }]
    };

    if (config.logFile) {
      config.logger.appenders.push(fileAppender = {
        "type": "file",
        "absolute": true,
        "filename": config.logFile,
        "maxLogSize": 20480,
        "backups": 10,
      });
      if (config.logLayout) {
        fileAppender.layout = typeof logLayout == 'object' ? logLayout : {
          type: 'pattern',
          pattern: config.logLayout
        };
      }
    }
  }

  config.logLevel = process.env.LOG_LEVEL || config.logLevel || 'info';
  config.logStackTraces = config.logStackTraces;
  config.logComponents = config.logComponents || [];
  config.logMessageDelimiter = config.logMessageDelimiter || ' ';

  if (['all', 'trace', 'debug'].indexOf(config.logLevel) > -1) {
    config.logTimeDelta = true;
  }

  if (config.logger.appenders.length > 0) {
    log4js.configure(config.logger);
    logger = log4js.getLogger();
    logger.setLevel(config.logLevel);
  }

}

module.exports.log = log = function(message, level, component, data) {

  if (!logger) return;
  if (config.logComponents.length > 0 &&
      config.logComponents.indexOf(component) < 0) return;

  var now, delim;

  try {

    level = level || 'info';

    if (logger[guard[level]]()) {

      message = message || '';
      component = component || '';

      delim = config.logMessageDelimiter;

      if (config.logTimeDelta) {
        message = ((now = Date.now()) - (previous || now)) + 'ms' + delim + '(' + component + ') ' + message;
        previous = now;
      }
      else {
        message = '(' + component + ') ' + message;
      }

      logger[level](message);

      if (data) {
        if (data.stack && config.logStackTraces) {
          logger[level](data.stack);
          return;
        }
        logger[level](data);
      }
    }
  } catch(e) {
    console.warn('logger failed! But here is the message anyways:');
    console.warn(message);
    console.warn(level);
    console.warn(e);
  }
}

module.exports.createLogger = function(component, obj) {
  obj = obj || function(message, data) {
    obj.$$DEBUG(message, data);
  };

  levels.forEach(function (level) {
    var on = guard[level];
    if (level == 'trace') {
      obj.$$TRACE = function(message, data) {
        if (!logger) return;
        if (!logger[on]()) return;
        if (config.logComponents.length > 0) { // can optimize with hash
          if (config.logComponents.indexOf(component.split('/')[0]) < 0) return;
        }
        log(message, level, component, data);
      }
    }
    else if (level == 'debug') {
      obj.$$DEBUG = function(message, data) {
        if (!logger) return;
        if (!logger[on]()) return;
        if (config.logComponents.length > 0) {
          if (config.logComponents.indexOf(component.split('/')[0]) < 0) return;
        }
        log(message, level, component, data);
      }
    }
    else {
      obj[level] = function(message, data) {
        if (!logger) return;
        if (!logger[on]()) return;
        log(message, level, component, data);
      }
    }
  });
  return obj;
}

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

