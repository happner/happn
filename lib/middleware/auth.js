module.exports = {
	process:function(req, res, next){
		var _this = this;

		if (req.message.path == '/auth'){

			//console.log('req.message.data');
			//console.log(req.message.data);

			_this.happn.services.auth.login(req.message.data, function(e, token){

				if (e)
					return next(e);

				req.result = token;
				next();
			});

		}else{

			if (req.headers['session_token'] == null)
				next('Missing session token');
			else{

				_this.happn.services.auth.decodeToken({token:req.headers['session_token']}, function(e, decoded){

					if (e) return next(e);

					req.session_data = decoded;
					next();

				});
			}
		}
			

		
	}
}