var async = require("async");
var shortid = require("shortid");

function RandomActivityGenerator(happnClient, opts) {

  if (!opts)
    opts = {};

  if (!opts.interval)
    opts.interval = 20;//20 milliseconds

  if (!opts.percentageGets)
    opts.percentageGets = [0,20];

  if (!opts.percentageSets)
    opts.percentageSets = [20,80];

  if (!opts.percentageRemoves)
    opts.percentageRemoves = [80,90];

  if (!opts.percentageOns)
    opts.percentageOns = [90,100];

  if (!opts.initialDataRemoveCount)
    opts.initialDataRemoveCount = 40;//40 items that can be .remove

  if (!opts.initialDataOnCount)
    opts.initialDataOnCount = 20;//20 items that can be .on

  if (!opts.initialDataGetCount)
    opts.initialDataGetCount = 50;//100 items that can be .get

  if (!opts.randomDataSize)
    opts.randomDataSize = 3;//multiplies 32 length string, so 320 characters

  if (!opts.onTimeout)
    opts.onTimeout = 100;//100 milliseconds

  this.__client = happnClient;

  this.__operationLog = {};
  this.__operationInitialData = {};
  this.__operationLogAggregated = {};
  this.__state = {};

  this.__updateLog = function(key, operationLogItem, operationResponse, operationError){

    operationLogItem.response = operationResponse;
    operationLogItem.error = operationError;
    this.__operationLog[key].push(operationLogItem);

    this.__operationLogAggregated[key][operationLogItem.opType]++;

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

  this.__getRandomPathFromInitial = function(key, operationType){
    var list = this.__operationInitialData[key][operationType];
    var randomIndex = Math.floor(Math.random() * list.length);

    return list[randomIndex].path;
  }

  this.__generateRandomData = function(key, operationType){

    var _this = this;

    var bigDataStr = "hsgatwyhrnshefd6yhrmesdatehfndbf";
    var bigData = "";

    for (var i = 0;i < opts.randomDataSize;i++)
      bigData += bigDataStr;

    return {key:key, data:shortid.generate(), bigData:bigData};
  }

  this.__generateRandomPath = function(key, operationType){

     var _this = this;

    if (["remove","get","on"].indexOf(operationType) > -1){
      return _this.__getRandomPathFromInitial(key, operationType);
    }

    return "/random_activity_generator/" + key + "/" +  shortid.generate();
  }

  this.__generateInitialGroup = function(key, opType, opCount, callback){

    var _this = this;

     async.times(opCount, function(n, next){
      var path = _this.__generateRandomPath(key) + "/initial_data/" + opType + "/" + n;
      var data = _this.__generateRandomData(key);

      _this.__client.set(path, data, function(e, response){
        if (e) return next(e);

        var operationLogItem = {
          opType:"set",
          path:path,
          data:data,
          key:key
        };

        _this.__operationInitialData[key][opType].push(operationLogItem);
        _this.__operationLogAggregated[key].initial[opType]++;

        next();
      });

    },callback);

  }

  this.__generateInitialData = function(key, callback){
    var _this = this;

    var millisecondsStart = new Date().getTime();

    _this.__generateInitialGroup(key, "remove", opts.initialDataRemoveCount, function(e){
      if (e) return callback(e);


      _this.__generateInitialGroup(key, "on", opts.initialDataOnCount, function(e){
        if (e) return callback(e);


        _this.__generateInitialGroup(key, "get", opts.initialDataGetCount, function(e){
          if (e) return callback(e);

          var millisecondsEnd = new Date().getTime();
          _this.__operationLogAggregated[key].initializationTimespan = millisecondsEnd - millisecondsStart;
          return callback(null, _this.__operationLogAggregated[key]);

        });
      });
    });
  }

  this.__initializeActivity = function(key){
    var _this = this;

    if (!key)key = 'default';

    _this.__operationLog[key] = [];
    _this.__operationLogAggregated[key] = {get:0, set:0, remove:0, on:0, initial:{on:0,get:0,remove:0}};
    _this.__operationInitialData[key] = {on:[], remove:[], get:[]};

    return _this.__operationLogAggregated[key];
  }

  this.__doOperation = function(key, operationLogItem, callback, initial){

    var _this = this;

    var operationDone = function(key, operationLogItem, response, e){

      if (!initial){
        _this.__updateLog(key, operationLogItem, response, e);
      }else{
        //replay - always sets for these
        _this.__operationInitialData[key][initial].push(operationLogItem);
        _this.__operationLogAggregated[key].initial[initial]++;
      }

      if (callback)
          callback(key, operationLogItem, response, e);

    }

    if (operationLogItem.opType == "get"){
      return _this.__client.get(operationLogItem.path, function(e, response){
        operationDone(key, operationLogItem, response, e);
      });
    }

    if (operationLogItem.opType == "set"){

      if (operationLogItem.data == null){//could be a replay
        var operationData = _this.__getRandomOperationData(key);
        operationLogItem.data = operationData;
      }

      return _this.__client.set(operationLogItem.path, operationLogItem.data, function(e, response){
          operationDone(key, operationLogItem, response, e);
      });
    }

    if (operationLogItem.opType == "remove"){
      return _this.__client.remove(operationLogItem.path, function(e, response){
         operationDone(key, operationLogItem, response, e);
      });
    }

    if (operationLogItem.opType == "on"){//crikey - thats gonna be hard
      _this.__client.on(operationLogItem.path,
      function(data){
        if (this.onHandler)//because sometimes .on gets doubled registered - this doesnt exist
          this.onHandler(data);//gets overriden on verify
      }.bind(operationLogItem),
      function(e, response){
        operationDone(key, operationLogItem, response, e);
      });
    }
  }

  this.generateActivityStart = function(key, callback){

    var _this = this;

    if (!key)key = 'default';

    _this.__initializeActivity(key);
    _this.__generateInitialData(key, function(e){

      if (e) return callback(e);

      _this.__state[key] = setInterval(function(){

        var operationType = _this.__getRandomOperationType(key);

        //if the type is get/remove/on, we take an existing path from the sets in the log
        var operationPath = _this.__generateRandomPath(key, operationType);
        var operationData = _this.__generateRandomData(key, operationType);

        var operationLogItem = {
          opType:operationType,
          path:operationPath,
          data:operationData,
          key:key
        };

        _this.__doOperation(key, operationLogItem);

      }, opts.interval);

      callback();

    });

  }

  this.generateActivityEnd = function(key, callback){
    var _this = this;
    setTimeout(function(){
      clearInterval(_this.__state[key]);
      callback(_this.__operationLogAggregated[key]);
    },  _this.__operationLogAggregated[key].initializationTimespan);

  }

  this.verifyOn = function(activityItem, callback){
    var _this = this;

    activityItem.cb = callback;
    activityItem.onHandler = function(data){
      this.handled = true;

      if (this.cb){//sometimes the .on is doubled up
        this.cb(null);
        delete this.cb;
      }

    }.bind(activityItem);

    _this.__client.set(activityItem.path, activityItem.data, function(e){

      if (e) return callback(e);

      setTimeout(function(){
        if (!activityItem.handled)
          return callback(new Error('on timed out'));
      }.bind(activityItem),
      opts.onTimeout);//configurable

    });
  }

  this.verifySet = function(activityItem, callback){
    var _this = this;
    _this.__client.get(activityItem.path, function(e, item){

      if (e) return callback(e);

      if (item.data != activityItem.data.data)
        return callback(new Error('set data does not match what is in the log'));

      if (item.bigData != activityItem.data.bigData)
        return callback(new Error('set bigData does not match what is in the log'));

      return callback(null);

    });
  }

  this.verifyRemove = function(activityItem, callback){
    var _this = this;
    _this.__client.get(activityItem.path, function(e, data){
      if (e) return callback(e);
      if (data) return callback(new Error('deleted item still exists'));
      callback(null);
    });
  }

  this.verifyItem = function(activityItem, callback, key){
    var _this  = this;

    this.__verifyLog[activityItem.key][activityItem.opType]++;

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

  this.__verifyLog = {};

  this.verify = function(callback, key){
    var _this = this;

    this.__verifyLog[key] = {"on":0, "get":0, "remove":0, "set":0};

    if (!key)key = 'default';

    var operationActivities = _this.__operationLog[key];
    async.eachSeries(operationActivities, _this.verifyItem.bind(_this), function(e){
      callback(e, _this.__verifyLog[key]);
    });
  }

  //replays a previous run
  this.replay = function(generator, key, callback){

    var _this = this;

    if (!key)key = 'default';

    _this.__initializeActivity(key);

    //_this.__operationInitialData[key][opType]
    async.eachSeries(generator.__operationInitialData[key]["get"], function(logItem, next){
      _this.__doOperation(key, logItem, function(key, operationLogItem, response, e){
        next(e);
      }, "get");
    }, function(e){

      if (e) return callback(e);

      async.eachSeries(generator.__operationInitialData[key]["remove"], function(logItem, next){
        _this.__doOperation(key, logItem, function(key, operationLogItem, response, e){
          next(e);
        }, "remove");
      }, function(e){

        if (e) return callback(e);

        async.eachSeries(generator.__operationInitialData[key]["on"], function(logItem, next){
          _this.__doOperation(key, logItem, function(key, operationLogItem, response, e){
            next(e);
          }, "on");
        }, function(e){

          if (e) return callback(e);

          _this.__operationInitialData[key] = generator.__operationInitialData[key];
          async.eachSeries(generator.__operationLog[key], function(logItem, next){
             _this.__doOperation(key, logItem, function(key, operationLogItem, response, e){
              next(e);
            });
          }, function(e){


            if (e) return callback(e);

            if (_this.__operationLogAggregated[key].get != generator.__operationLogAggregated[key].get)
              return callback(new Error('invalid replay: gets dont match'));
            if (_this.__operationLogAggregated[key].set != generator.__operationLogAggregated[key].set)
              return callback(new Error('invalid replay: set dont match'));
            if (_this.__operationLogAggregated[key].remove != generator.__operationLogAggregated[key].remove)
              return callback(new Error('invalid replay: remove dont match'));
            if (_this.__operationLogAggregated[key].on != generator.__operationLogAggregated[key].on)
              return callback(new Error('invalid replay: on dont match'));

            callback(null, _this.__operationLogAggregated[key]);

          });

        });

      });

    });
  }

  this.getOperationLog = function(){
    return _this.__operationLog;
  }

};

module.exports = RandomActivityGenerator;

