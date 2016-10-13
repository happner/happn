var util = require('util')
  , EventEmitter = require('events').EventEmitter
  , Promise = require('bluebird')
;

function LocalClient(){
  this._local = true;
}

util.inherits(LocalClient, EventEmitter);

LocalClient.prototype.end = function(){
  this.__closed = true;
  this.emit('end');
};

LocalClient.prototype.write = function(message){
  var _this = this;

  if (this.__closed) throw new Error('client is disconnected');

  setImmediate(function(){

      try{
        //for a quicker check than looking at _meta.type data/response or Array.isArray
        if (message.__outbound) return _this.handle_publication(message);
        _this.context.services.session.handleMessage(_this.context.services.utils.clone(message), _this);

      }catch(e){
        _this.context.services.error.handleSystem(e);
      }

  }.bind(this));
};

//needs to be here
LocalClient.prototype.removeAllListeners = function(instruction){};

LocalClient.prototype.destroy = function(){
  this.__closed = true;
  this.emit('destroy');
};

//events open, error, data, reconnected, reconnect timeout, reconnect scheduled

function LocalClientWrapper(){
  this.clientType = 'eventemitter';

  this.__getConnection = function () {

    var client = new LocalClient();

    Object.defineProperty(client, 'context', {value:this.context});
    Object.defineProperty(client, 'handle_publication', {value:this.handle_publication.bind(this)});
    Object.defineProperty(client, 'handle_response', {value:this.handle_response.bind(this)});

    client.sessionProtocol = 'happn_' + require('../../../package.json').protocol;

    this.context.services.session.onConnect(client);

    this.__client = client;

    return client;
  };

  this.disconnect = Promise.promisify(function(callback){

    var _this = this;

    this.context.services.session.on('disconnect', function(data){
      if (data.id == _this.__client.sessionId) callback();
    });

    this.context.services.session.disconnect(this.__client, 'disconnecting local');
  });
}

module.exports = new LocalClientWrapper();
