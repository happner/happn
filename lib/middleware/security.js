module.exports = {
	__tryDecodeToken:function(token){
		try{
			return this.happn.services.security.decodeToken(token);
		}catch(e){
			return null;
		}
	},
	__respondError:function(res, data){
		res.writeHead( 403, 'unauthorized access', {'content-type' : 'text/plain'});
		return res.end('happn_token cookie missing in request');
	},
	process:function(req, res, next){
		var _this = this;

		if (_this.happn.config.secure){

			try{

				var token = req.cookies.get('happn_token');

				if (!token) return _this.__respondError(res, 'happn_token cookie missing in request');
					
				var credentials = _this.__tryDecodeToken(token);

				if (!credentials) return _this.__respondError(res, 'invalid happn_token cookie');

				if (req.url.substring(0, 1) != '/')
					req.url = '/' + req.url;

				var path = '/HTTP' + req.method + req.url;

				_this.happn.services.security.authorize(credentials, path, 'get', function(e, authorized){

					if (e) return next(e);

					if (!authorized) return _this.__respondError(res, 'unauthorized access to path ' + path);

					next();

				});

			}catch(e){
				next(e);
			}

		}
		else
			next();
			

	}
}