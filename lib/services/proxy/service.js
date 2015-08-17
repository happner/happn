var Primus = require('primus'),
	wildcard = require('wildcard'),
	utc = require('moment').utc(),
	path = require('path'),
	shortid = require('shortid');
	
module.exports = {
	__proxyWebSockets:{},
	_proxyWebSocketsCount:0,
	__proxyHttp:{},
	_proxyHttpCount:0,
	__createHttpProxy:function(host, port, paths, callback){
		
	},
	__createWSProxy:function(host, port, paths, callback){
		
	},
	registerWebSocket:function(host, port, paths, callback){

		var _this = this;

		if (!paths)
			paths = ["/*"];//default to proxying everything

		_this.__createWSProxy(host, port, paths, function(e, proxy){
			if (e) return callback(e);

			_this.__proxyWebSockets[host + ':' + port] = proxy;
			_proxyWebSocketsCount++;

			callback();
		});

	},
	deRegisterWebSocket:function(host, port){

		delete this.__proxies[host + ':' + port];
		this._proxyWebSocketsCount--;

	},
	stats: function(opts){
		var _this = this;
		return {
			proxied:_this.__addressList
		}
	},
	initialize: function(config, done) {
		var _this = this;
		if (config.timeout) config.timeout = false;
		_this.utils = _this.happn.utils;

		if (config.enabled)
			_this.enabled = true;

		done();
	},
	relayHttp:function(req, res, next){

	},
	relayWebSocket:function(message, socketInstance, callback) {

		var _this = this;
		var proxied = false;
		
		if (!message.path || _this._proxyWebSocketsCount == 0)
			return callback(null, proxied);

		async.eachSeries(Object.keys(__proxyWebSockets), function(proxyKey, proxyCallback){
			var proxy = __proxyWebSockets[proxyKey];
			var proxyMatches = _this.utils.matchPaths(message.path, proxy.paths);

			if (proxyMatches.length > 0){
				proxy.relay(message, socketInstance, function(e){

					if (!e)
						proxied = true;

					proxyCallback(e);
				});
			}
		}, 
		function(e){
			callback(e, proxied);
		});

	}
}