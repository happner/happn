var traverse = require('traverse');

module.exports = {
	process:function(req, res, next){
		var _this = this;

	    if (req.message.path == '/auth')
	    	return next();

	    var dataService = _this.happn.services.data;
	    var message = req.message;

	    var respond = function(e, result){

        	if (!e)
				req.result = result;
            return next(e);

        }

	    try{

	        if (message.action == 'GET')
	        	dataService.get(message.path, message.parameters, respond);
	        else if (message.action == 'PUT')
	        	dataService.upsert(message.path, message.data, message.parameters, respond);
			else if (message.action == 'DELETE')
	       		 dataService.remove(message.path, message.parameters, respond);

	    }catch(e){
	    	next(e);
	    }
	}
}