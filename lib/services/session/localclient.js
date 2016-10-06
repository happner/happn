var Promise = require('bluebird')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
;

function LocalClient(){

}

util.inherits(LocalClient, EventEmitter);

LocalClient.prototype.end = function(){
  this.emit('end');
};

LocalClient.prototype.write = function(message){
  var _this = this;

  //for a quicker check than looking at _meta.type data/response or Array.isArray
  if (message.__outbound){
    try{
      //we know this is a server write
      _this.handle_publication(message);
    }catch(e){
      _this.context.services.error.handleSystem(e);
    }
  } else setImmediate(function(){
    try{
      //this is a write to the server
      _this.context.services.session.handleMessage(_this.context.services.utils.clone(message), _this);
    }catch(e){
      _this.context.services.error.handleSystem(e);
    }
  });
};

//needs to be here
LocalClient.prototype.removeAllListeners = function(instruction){};

LocalClient.prototype.destroy = function(){
  this.emit('destroy');
};

//events open, error, data, reconnected, reconnect timeout, reconnect scheduled

module.exports = {

  clientType: 'eventemitter',

  __getConnection: function () {

    var client = new LocalClient();

    Object.defineProperty(client, 'context', {value:this.context});
    Object.defineProperty(client, 'handle_publication', {value:this.handle_publication.bind(this)});
    Object.defineProperty(client, 'handle_response', {value:this.handle_response.bind(this)});

    client.sessionProtocol = 'happn_' + require('../../../package.json').protocol;

    this.context.services.session.onConnect(client);

    return client;
  }
};
