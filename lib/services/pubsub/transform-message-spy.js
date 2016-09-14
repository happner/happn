function TransformMessageSpy(){

}

TransformMessageSpy.prototype.initialize = function(config, callback){
  this.config = config;
  this.active = true;
  callback();
};

TransformMessageSpy.prototype.incoming = function(packet, next){

  if (!this.active) return next();

  console.log(JSON.stringify(packet, null, 2));

  if ( this.config.log)  this.config.log('incoming', packet);

  next();
};

TransformMessageSpy.prototype.outgoing = function(packet, next){

  if (!this.active) return next();

  console.log(JSON.stringify(packet, null, 2));

  if ( this.config.log)  this.config.log('outgoing', packet);

  next();
};

TransformMessageSpy.prototype.active = false;


module.exports = TransformMessageSpy;
