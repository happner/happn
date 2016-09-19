function TransformProtocol(){

}

TransformProtocol.prototype.initialize = function(config, callback){
  this.protocolVersion = require('../../../package.json').protocol;

  callback();
};

TransformProtocol.prototype.incoming = function(packet, next){
  //backwards compatibility issues on incoming packets could be dealt with here

  if (!packet.data.headers) packet.data.headers = {};

  next();
};

TransformProtocol.prototype.outgoing = function(packet, next){

  if (!packet.data.headers) packet.data.headers = {};
  packet.data.headers.protocol = this.protocolVersion;
  next();
};


module.exports = TransformProtocol;
