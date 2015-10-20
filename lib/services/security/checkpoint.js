

module.exports = CheckPoint;

function CheckPoint() {

}

var __manifestID = Date.now();
var __permissionSets = {};//in-memory keyed by group names ordered alphabetically - pointing to permissions dictionary

var __groupCache = {}; // in-memory cache of all groups
var __permissionCache = {}; //LRU cache - configurable in size, keyed by permissionSetKey + path + action, result either true or false

CheckPoint.prototype.initialize = function(config, dataService, pubsubService, callback){
	var _this = this;
	try{
		_this.dataService = dataService;
		_this.pubsubService = pubsubService;
		callback();
	}catch(e){
		callback(e);
	}
}

CheckPoint.prototype.__constructPermissionSet = function(permissionSetKey, path){

}

CheckPoint.prototype.getPermissions = function(permissionSetKey, path){

}


CheckPoint.prototype.authorize = function(session, path, action, callback){
	console.log('authorizing', session, path, action);

	try{

		var permissionSetKey = this.__getPermissionSetKey(session);

		if (__permissionSets[permissionSetKey]){
			return callback(null, this.getPermissions(permissionSetKey, path).indexOf(action) > -1);
		}else{
			this.__constructPermissionSet(session, function(e){
				if (e) return callback(e);	

				return callback(null, this.getPermissions(permissionSetKey, path).indexOf(action) > -1);
			});
		}

	}catch(e){
		callback(e);
	}
}

CheckPoint.prototype.manifestChanged = function(event, changedData){
	console.log('manifestChanged', event, changedData);

	this.__manifestID = Date.now();

	this.__permissionSets = {};//clear the permission set cache
	this.__groupCache = {};//clear the group cache
	this.__permissionCache = {};//clear permission cache
	
	//TODO - we need to update all the clients in pubsub

}