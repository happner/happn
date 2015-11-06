var LRU = require("lru-cache");
module.exports = CheckPoint;
var async = require("async");

function CheckPoint() {

}

var __permissionCacheOpts = { 
	max: 1000,
	maxAge: 0
}

var __manifestID = Date.now();

var __permissionSets = {};//in-memory keyed by group names ordered alphabetically - pointing to permissions dictionary
var __permissionCache = LRU(__permissionCacheOpts); //LRU cache - configurable in size, keyed by permissionSetKey + path + action, result either true or false

var __authorizedAction = function(action, permission){

	for (var permissableActionIndex in permission.actions){
		if (permission.actions[permissableActionIndex] == action || permission.actions[permissableActionIndex] == '*')
			return true;
	}

	return false;
}

CheckPoint.prototype.__authorized = function(permissionSet, path, action){

	for (var permissionPath in permissionSet.explicit){
		if (permissionPath == path){
			if (__authorizedAction(action, permissionSet.explicit[permissionPath]))
				return true;
		}
	}

	for (var permissionPath in permissionSet.wildcard){
		if (this.securityService.happn.utils.wildcardMatch(permissionPath, path)){
			if (__authorizedAction(action, permissionSet.wildcard[permissionPath]))
				return true;
		}
	}


	return false;
}

CheckPoint.prototype.__constructPermissionSet = function(session, path, callback){

	var _this = this;
	var permissionSet = {explicit:{}, wildcard:{}};

	async.each(Object.keys(session.user.groups), function(groupName, eachCB){

		_this.securityService.getGroup(groupName, {}, function(e, group){

			if (e) return eachCB(e);

			for (var permissionPath in group.permissions){
				if (permissionPath.indexOf('*') > -1)
					permissionSet.wildcard[permissionPath] = group.permissions[permissionPath];
				else
					permissionSet.explicit[permissionPath] = group.permissions[permissionPath];
			}

			permissionSet.wildcard = _this.securityService.happn.utils.wildcardAggregate(permissionSet.wildcard);

			eachCB();

		});

	}, function(e){

		if (e) return callback(e);

		__permissionSets[session.permissionSetKey] = permissionSet;
		callback(null, permissionSet);

	});
}

CheckPoint.prototype.initialize = function(config, securityService, callback){
	var _this = this;
	try{
		_this.securityService = securityService;
		_this.securityService.onDataChanged(_this.securityDirectoryChanged.bind(_this));
		callback();
	}catch(e){
		callback(e);
	}
}

CheckPoint.prototype._authorize = function(session, path, action, callback){
	
	try{

		var authorized = __permissionCache.get(session.permissionSetKey + path + action);

		if (authorized == undefined){

			if (__permissionSets[session.permissionSetKey]){

				authorized = this.__authorized(__permissionSets[session.permissionSetKey], path, action);
				__permissionCache.set(session.permissionSetKey + path + action, authorized);

				return callback(null, authorized);

			}else{

				var _this = this;

				_this.__constructPermissionSet(session, path, function(e, permissionSet){
				
					if (e) return callback(e);

					authorized = _this.__authorized(permissionSet, path, action);
					__permissionCache.set(session.permissionSetKey + path + action, authorized);

					return callback(null, authorized);

				});
			}

		}else{
			return callback(null, authorized);
		}

	}catch(e){
		callback(e);
	}
}

CheckPoint.prototype.securityDirectoryChanged = function(whatHappnd, changedData){

	__manifestID = Date.now();

	__permissionSets = {};//clear the permission set cache
	__permissionCache = LRU(__permissionCacheOpts);//clear permission cache

	return true;

}