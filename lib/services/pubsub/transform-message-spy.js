function TransformMessageSpy(){

}

TransformMessageSpy.prototype.initialize = function(config, callback){

  this.config = config;
  this.active = true;

  callback();
};

TransformMessageSpy.prototype.incoming = function(packet, next){

  if (!this.active) return next();

  if (!this.config || !this.config.suppressPrint){
    console.log('INCOMING PACKET:::');
    console.log(JSON.stringify(packet, null, 2));
  }

  if (this.config && this.config.log)  this.config.log('incoming', packet);

  next();
};

TransformMessageSpy.prototype.outgoing = function(packet, next){

  if (!this.active) return next();

  if (!this.config || !this.config.suppressPrint) {
    console.log('OUTGOING PACKET:::');
    console.log(JSON.stringify(packet, null, 2));
  }

  if (this.config &&  this.config.log)  this.config.log('outgoing', packet);

  next();
};


module.exports = TransformMessageSpy;
