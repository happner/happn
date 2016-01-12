var LRU = require("lru-cache");
var async = require("async");
module.exports = CheckPoint;

function CheckPoint(opts) {

	// if (!opts) opts = {};

  this.log = opts.logger.createLogger('CheckPoint');
  this.log.$$TRACE('construct(%j)', opts);

	if (!opts.permissionCache)
	opts.permissionCache = { 
		max: 1000,
		maxAge: 0
	}

	this.opts = opts;

	this.__manifestID = Date.now();
	this.__permissionSets = {};//in-memory keyed by group names ordered alphabetically - pointing to permissions dictionary
	this.__permissionCache = LRU(opts.permissionCache); //LRU cache - configurable in size, keyed by permissionSetKey + path + action, result either true or false

}


CheckPoint.prototype.__authorizedAction = function(action, permission){

	for (var permissableActionIndex in permission.actions){
		if (permission.actions[permissableActionIndex] == action || permission.actions[permissableActionIndex] == '*')
			return true;
	}

	return false;
}

CheckPoint.prototype.__authorized = function(permissionSet, path, action){
	
	for (var permissionPath in permissionSet.explicit){
		if (permissionPath == path){
			if (this.__authorizedAction(action, permissionSet.explicit[permissionPath]))
				return true;
		}
	}

	for (var permissionPath in permissionSet.wildcard){
		if (this.securityService.happn.utils.wildcardMatch(permissionPath, path)){
			if (this.__authorizedAction(action, permissionSet.wildcard[permissionPath]))
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

		_this.__permissionSets[session.permissionSetKey] = permissionSet;
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

		var authorized = this.__permissionCache.get(session.permissionSetKey + path + action);

		if (authorized == undefined){

			if (this.__permissionSets[session.permissionSetKey]){

				authorized = this.__authorized(this.__permissionSets[session.permissionSetKey], path, action);
				this.__permissionCache.set(session.permissionSetKey + path + action, authorized);

				return callback(null, authorized);

			}else{

				var _this = this;

				_this.__constructPermissionSet(session, path, function(e, permissionSet){
				
					if (e) return callback(e);

					

					authorized = _this.__authorized(permissionSet, path, action);
					_this.__permissionCache.set(session.permissionSetKey + path + action, authorized);

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

	this.__manifestID = Date.now();

	this.__permissionSets = {};//clear the permission set cache
	this.__permissionCache = LRU(this.opts.permissionCache);//clear permission cache

	return true;

}