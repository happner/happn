module.exports = {
	process:function(req, res, next){
		if (this.happn.services.proxy._proxyHttpCount > 0)
			_this.happn.services.proxy.relay(req, res, next);
		else
			next();
	}
}