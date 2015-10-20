

module.exports = CheckPoint;

function CheckPoint() {

}

CheckPoint.prototype.initialize = function(config, dataService, callback){
	var _this = this;
	try{
		_this.dataService = dataService;
		callback();
	}catch(e){
		callback(e);
	}
}

CheckPoint.prototype.authorize = function(session, path, action, callback){
	console.log('authorizing', session, path, action);
	callback();
}

CheckPoint.prototype.clearCache = function(event, changedData){
	console.log('cache-cleared', event, changedData);
}