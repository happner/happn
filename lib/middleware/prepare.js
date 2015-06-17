module.exports = {
	process:function(req, res, next){
		try{

			var url = require('url').parse(req.url, true);

			if (req.body.encapsulated == null){

				if (req.body.basetype == 'array')
					req.body.encapsulated = [];
				else
					req.body.encapsulated = {};

			}

			//console.log('preparing bod');
			//console.log(req.body);

			var data = req.body.encapsulated;

			if (req.body.client == 'jquery'){ //solved the issue whereby $ makes all property types strings...
				//console.log(req.body.client + ' client');
				data = JSON.parse(decodeURIComponent(req.body.encapsulated));
				//console.log(data);
			}

			req.message = {
				action:req.method,
				path:url.pathname,
				headers:req.headers,
				data:data
			};

			if (url.query && url.query["parameters"]){
				try{
					req.message.parameters = JSON.parse(new Buffer(url.query["parameters"], 'base64').toString('ascii'));
				}catch(e){
					return next('Invalid parameters passed by client, must be base64 encoded JSON');
				}
				
			}else
				req.message.parameters = {};

			//console.log('preparing');
			//console.log(req.message);

			next();

		}catch(e){
			next(e);
		}

	}
}