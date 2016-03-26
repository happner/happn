var async = require("async");
var shortid = require("shortid");

function RandomActivityGenerator(happnClient, opts) {

  if (!opts)
    opts = {};

  if (!opts.interval)
    opts.interval = 100;//100 milliseconds

  if (!opts.percentageGets)
    opts.percentageGets = [0,20];

  if (!opts.percentageSets)
    opts.percentageSets = [20,80];

  if (!opts.percentageRemoves)
    opts.percentageRemoves = [80,90];

  if (!opts.percentageOns)
    opts.percentageOns = [90,100];

  if (!opts.initialDataRemoveCount)
    opts.initialDataRemoveCount = 40;//100 items that can be .remove

  if (!opts.initialDataOnCount)
    opts.initialDataOnCount = 20;//100 items that can be .on

  if (!opts.randomDataSize)
    opts.randomDataSize = 3;//multiplies 32 length string, so 320 characters

  this.__client = happnClient;

  var __operationLog = {};
  var __operationInitialData = {};
  var __operationLogAggregated = {};
  var __state = {};

  function __updateLog(key, operationLogItem, operationPayload, operationError){
    operationLogItem.payload = operationPayload;
    operationLogItem.error = operationError;
    __operationLog[key].push(operationLogItem);
    __operationLogAggregated[key]++;
    return operationLogItem;
  }

  this.generateActivity = function(timespan, callback, key){
    this.generateActivityStart(key);
    setTimeout(timespan, this.generateActivityEnd.call(this, key));
  }

  this.__getRandomOperationType = function(){

    var random = Math.floor(Math.random() * 100);
    if (random >= opts.percentageGets[0] && random <= opts.percentageGets[1])
      return 'get';
    if (random >= opts.percentageSets[0] && random <= opts.percentageSets[1])
      return 'set';
    if (random >= opts.percentageRemoves[0] && random <= opts.percentageRemoves[1])
      return 'remove';
    if (random >= opts.percentageOns[0] && random <= opts.percentageOns[1])
      return 'on';

    throw new Error('random value ' + random + ' does not fall into operation ranges');
  }

  this.__generateRandomData = function(key, operationType){

    var bigDataStr = "hsgatwyhrnshefd6yhrmesdatehfndbf";
    var bigData = "";

    for (var i = 0;i < opts.randomDataSize;i++)
      bigData += bigDataStr;

    return {key:key, data:shortid.generate(), bigData:bigData};
  }

  this.__generateRandomPath = function(key, operationType){
    return "/random_activity_generator/" + key + "/" +  shortid.generate();
  }

  this.__generateInitialData = function(key, callback){
    var _this = this;

    var millisecondsStart = new Date().getTime();

    async.times(opts.initialDataRemoveCount, function(n, next){
      var path = _this.__generateRandomPath(key) + "/initial_data/remove/" + n;
      var data = _this.__generateRandomData(key);

      _this.__client.set(path, data, function(e, response){
        if (e) return next(e);
        __operationInitialData[key].remove.push(response);
        __operationLogAggregated[key].initialRemove++;
        next();
      });

    },function(e){

      if (e) return callback(e);

      async.times(opts.initialDataOnCount, function(n, next){
        var path = _this.__generateRandomPath(key) + "/initial_data/on/" + n;
        var data = _this.__generateRandomData(key);

        _this.__client.set(path, data, function(e, response){
          if (e) return next(e);
          __operationInitialData[key].on.push(response);
          __operationLogAggregated[key].initialOn++;
          next();
        });

      },function(e){
        if (e) return callback(e);
        var millisecondsEnd = new Date().getTime();
        __operationLogAggregated[key].initializationTimespan = millisecondsEnd - millisecondsStart;

        return callback(null, __operationLogAggregated[key]);
      });
    });
  }

  this.__initializeActivity = function(key){
    var _this = this;

    if (!key)key = 'default';
    __operationLog[key] = [];
    __operationLogAggregated[key] = {gets:0, sets:0, removes:0, ons:0, initialRemove:0, initialOn:0};
    __operationInitialData[key] = {on:[], remove:[]};

    return __operationLogAggregated[key];
  }

  this.__doOperation = function(operationLogItem, callback){

    if (operationLogItem.opType == "get"){
      _this.__client.get(operationLogItem.path, function(e, response){
        __updateLog(key, operationLogItem, response, e);
        callback(key, operationLogItem, response, e);
      });
    }

    if (operationLogItem.opType == "set"){

      if (operationLogItem.data == null){//could be a replay
        var operationData = _this.__getRandomOperationData(key);
        operationLogItem.data = operationData;
      }

      _this.__client.set(operationLogItem.path, operationData, function(e, response){
         __updateLog(key, operationLogItem, response, e);
         callback(key, operationLogItem, response, e);
      });
    }

    if (operationLogItem.opType == "remove"){
      _this.__client.remove(operationLogItem.path, function(e, response){
        __updateLog(key, operationLogItem, response, e);
        callback(key, operationLogItem, response, e);
      });
    }

    if (operationLogItem.opType == "on"){//crikey - thats gonna be hard
       _this.__client.on(operationLogItem.path, function(data){
        this.onHandler(data);//gets overriden on verify
      }.bind(operationLogItem), function(e){
        __updateLog(key, operationLogItem, null, e);
        callback(key, operationLogItem, null, e);
      });
    }
  }

  this.generateActivityStart = function(key, callback){

    var _this = this;
    _this.__initializeActivity(key);

    _this.__generateInitialData(key, function(e){

      if (e) return callback(e);

      state[key] = setInterval(function(){

        var operationType = _this.__getRandomOperationType(key);

        //if the type is get/remove/on, we take an existing path from the sets in the log
        var operationPath = _this.__generateRandomPath(key, operationType);
        var operationData = _this.__generateRandomData(key, operationType);

        var operationLogItem = {
          opType:operationType,
          path:operationPath,
          data:operationData
        };

        this.__doOperation(operationLogItem);

      }, opts.interval);

      callback();

    });

  }

  this.generateActivityEnd = function(key){

    setTimeout(function(){
      clearInterval(state[key]);
    },  __operationLogAggregated[key].initializationTimespan);

  }

  this.verifyOn = function(activityItem, callback){
    var timedout = true;

    activityItem.onHandler = function(data){
      timedout = false;
      return callback(null);
    }

    _this.__client.set(activityItem.path, activityItem.data, function(){
      timedout = setTimeout(function(){
        if (timedout)
          return callback(new Error('on timed out'));
      }, 500);
    });
  }

  this.verifySet = function(activityItem, callback){
    _this.__client.get(activityItem.path, function(e, data){
      if (e) return callback(e);

      if (data.value == activityItem.data.value)
        return callback(null);
      else
        return callback(new Error('set data does not match what is in the log'));
    });
  }

  this.verifyRemove = function(activityItem, callback){
    _this.__client.get(activityItem.path, function(e, data){
      if (e) return callback(e);
      if (data) return callback(new Error('deleted item still exists'));
      callback(null);
    });
  }

  this.verifyDataItem = function(activityItem, callback){
    var _this  = this;

    if (activityItem.error)//takes care of get
        return callback(activityItem.error);

    if (activityItem.opType == "set"){
      return _this.verifySet(activityItem, callback);
    }

    if (activityItem.opType == "remove"){
      return _this.verifyRemove(activityItem, callback);
    }

    if (activityItem.opType == "on"){//crikey - thats gonna be hard
      return _this.verifyOn(activityItem, callback);
    }

    callback(null);
  }

  this.verifyData = function(callback, key){
    var _this = this;
    if (!key)key = 'default';
    var operationActivities = __operationLog[key];

    async.eachSeries(operationActivities, _this.verifyDataItem, callback);
  }

  //replays a previous run
  this.replay = function(operationLog, callback, key){
    var _this = this;
    if (!key)key = 'default';

    async.eachSeries(operationLog, function(logItem, next){

    }, function(e){

    })
  }

  this.getOperationLog = function(){
    return __operationLog;
  }

};

module.exports = RandomActivityGenerator;

