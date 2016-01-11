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
				
				var session_token = _this.__tryDecodeToken(token)

				if (!session_token) return _this.__respondError(res, 'invalid token format or null token');

				var session = _this.happn.services.pubsub.getSession(session_token.id);

				if (!session) return _this.__respondError(res, 'session expired');

				if (req.url.substring(0, 1) != '/')
					req.url = '/' + req.url;

				var path = '/@HTTP' + req.url;

				_this.happn.services.security.authorize(session, path, req.method.toLowerCase(), function(e, authorized){

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