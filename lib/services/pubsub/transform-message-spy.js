function TransformMessageSpy(){

}

TransformMessageSpy.prototype.initialize = function(config, callback){
  this.config = config;
  callback();
};

TransformMessageSpy.prototype.incoming = function(packet, next, pubsub){

  if (!this.active) return next();

  console.log(JSON.stringify(packet, null, 2));

  if ( this.config.log)  this.config.log(packet);

  next();
};

TransformMessageSpy.prototype.outgoing = function(packet, next, pubsub){

  if (!this.active) return next();

  console.log(JSON.stringify(packet, null, 2));

  if ( this.config.log)  this.config.log(packet);

  next();
};

TransformMessageSpy.prototype.active = false;


module.exports = TransformMessageSpy;
