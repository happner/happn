module.exports = {
	process:function(req, res, next){
		var _this = this;

		if (_this.happn.config.secure){

			try{

				var token = req.cookies.get('happn_token');

				if (!token)
					return next(_this.happn.services.security.AccessDeniedError('happn_token cookie missing in request'));

				var credentials = _this.happn.services.security.decodeToken(token);
				var path = req.url + '/' + req.method;


				_this.happn.services.security.authorize(credentials, path, 'get', function(e, authorized){

					if (e) return next(e);

					if (!authorized){

						res.writeHead( 403, 'unauthorized access', {'content-type' : 'text/plain'});
    					return res.end( 'unauthorized access to path ' + path);

					} 

					next();

				});

			}catch(e){
				next(e);
			}

		}
		else
			next();

		//

		// if (req.message.path == '/auth'){

		// 	//console.log('req.message.data');
		// 	//console.log(req.message.data);

		// 	_this.happn.services.auth.login(req.message.data, function(e, token){

		// 		if (e)
		// 			return next(e);

		// 		req.result = token;
		// 		next();
		// 	});

		// }else{

		// 	if (req.headers['session_token'] == null)
		// 		next('Missing session token');
		// 	else{

		// 		_this.happn.services.auth.decodeToken({token:req.headers['session_token']}, function(e, decoded){

		// 			if (e) return next(e);

		// 			req.session_data = decoded;
		// 			next();

		// 		});
		// 	}
		// }
			

	}
}