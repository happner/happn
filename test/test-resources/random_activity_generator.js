(function() { // begin enclosed

  var browser = false;

  function RandomActivityGenerator(happnClient, opts) {

    if (!opts)
      opts = {};

    if (!opts.interval)
      opts.interval = 50;//50 milliseconds

    if (!opts.percentageGets)
      opts.percentageGets = [0,20];

    if (!opts.percentageSets)
      opts.percentageSets = [20,80];

    if (!opts.percentageDeletes)
      opts.percentageDeletes = [80,90];

    if (!opts.percentageOns)
      opts.percentageOns = [90,100];

    this.__client = happnClient;

    var __operationLog = {};
    var __operationLogAggregated = {};
    var __state = {};

    function __updateLog(key, operationLogItem, operationPayload){
      operationLogItem.payload = operationPayload;
      __operationLog[key].push(operationLogItem);
      __operationLogAggregated[key]++;
    }

    this.generateActivity = function(timespan, callback, key){
      this.generateActivityStart(key);
      setTimeout(timespan, this.generateActivityEnd.call(this, key));
    }

    this.generateActivityStart = function(key){
      var _this = this;
      if (!key)key = 'default';

      __operationLog[key] = [];
      __operationLogAggregated[key] = 0;

      state[key] = setInterval(function(){

        var operationType = _this.__getRandomOperationType();

        //if the type is get/remove/on, we take an existing path from the sets in the log
        var operationPath = _this.__getRandomOperationPath(key, operationType);

        var operationLogItem = {
          type:operationType,
          path:operationPath
        };

        if (operationType == "get"){
          _this.__client.get(operationPath, function(e, response){
            __updateLog(key, operationLogItem, response);
          });
        }

        if (operationType == "set"){
          var operationData = _this.__getRandomOperationData(key);
          operationLogItem.data = operationData;
          _this.__client.set(operationPath, operationData, function(e, response){
             __updateLog(key, operationLogItem, response);
          });
        }

        if (operationType == "remove"){
          _this.__client.remove(operationPath, function(e, response){
            __updateLog(key, operationLogItem, response);
          });
        }

        if (operationType == "on"){//crikey - thats gonna be hard
           _this.__client.on(operationPath, function(data){
            //what to do here...?
          }, function(e){
            __updateLog(key, operationLogItem, response);
          });
        }



      },opts.interval);
    }

    this.generateActivityEnd = function(key){
      clearInterval(state[key]);
    }

    this.verifyData = function(callback, key){

    }

    //replays a previous run
    this.replay = function(operationLog, callback, key){

    }

    this.getOperationLog = function(){
      return __operationLog;
    }

  };

})(); // end enclosed
