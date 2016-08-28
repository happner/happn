var LRU = require("lru-cache");
var async = require("async");
module.exports = CheckPoint;

function CheckPoint(opts) {

  this.log = opts.logger.createLogger('CheckPoint');
  this.log.$$TRACE('construct(%j)', opts);

  if (!opts.permissionCache) opts.permissionCache = {max: 1000, maxAge: 0 };

  if (!opts.expiryGrace) opts.expiryGrace = 60;//default expiry grace of 1 minute

  if (!opts.groupPermissionsPolicy) opts.groupPermissionsPolicy = 'most_restrivtive';

  this.opts = opts;

  this.__manifestID = Date.now();
  this.__permissionSets = {};//in-memory keyed by group names ordered alphabetically - pointing to permissions dictionary
  this.__permissionCache = LRU(opts.permissionCache); //LRU cache - configurable in size, keyed by permissionSetKey + path + action, result either true or false

  this.__inactivityCounters = {};
  this.__usageLimitCounters = {};

}


CheckPoint.prototype.__authorizedAction = function (action, permission) {

  for (var permissableActionIndex in permission.action) {
    if (permission.action[permissableActionIndex] == action || permission.action[permissableActionIndex] == '*')
      return true;
  }

  return false;
};

CheckPoint.prototype.__authorized = function (permissionSet, path, action) {

  for (var permissionPath in permissionSet.explicit) {

    if (permissionPath == path) {
      if (this.__authorizedAction(action, permissionSet.explicit[permissionPath])) return true;
    }
  }

  for (var permissionPath in permissionSet.wildcard) {

    if (this.securityService.happn.utils.wildcardMatch(permissionPath, path)) {
      if (this.__authorizedAction(action, permissionSet.wildcard[permissionPath]))
        return true;
    }
  }

  return false;
};

CheckPoint.prototype.__createPermissionSet = function(permissions){

  var _this = this;
  var permissionSet = {explicit: {}, wildcard: {}};

  for (var permissionPath in permissions) {
    if (permissionPath.indexOf('*') > -1)
      permissionSet.wildcard[permissionPath] = permissions[permissionPath];
    else
      permissionSet.explicit[permissionPath] = permissions[permissionPath];
  }

  permissionSet.wildcard = _this.securityService.happn.utils.wildcardAggregate(permissionSet.wildcard);

  return permissionSet;

};

CheckPoint.prototype.__resolveConflictingPermission = function(compare1, compare2){
  //TODO: conflicting permissions may cause issues here, propose a policy of taking the least lenient permission

  if (this.opts.groupPermissionsPolicy == 'least_restrictive'){
    //find the least restrictive permission
  }else{
    //find the most restrictive permission
  }

  return compare2;
};

CheckPoint.prototype.__loadPermissionSet = function(identity, callback){

  var _this = this;
  var permissions = {};

  async.each(Object.keys(identity.user.groups), function (groupName, eachCB) {

    _this.securityService.getGroup(groupName, {}, function (e, group) {

      if (e) return eachCB(e);

      for (var permissionPath in group.permissions){

        if (permissions[permissionPath]){
          //we have a conflicting permission
          permissions[permissionPath] = _this.__resolveConflictingPermission(permissions[permissionPath], group.permissions[permissionPath]);

        }else permissions[permissionPath] = group.permissions[permissionPath];
      }

      eachCB();

    });

  }, function (e) {

    if (e) return callback(e);

    _this.__permissionSets[identity.permissionSetKey] = _this.__createPermissionSet(permissions);

    callback(null,  _this.__permissionSets[identity.permissionSetKey]);

  });
};

CheckPoint.prototype.__constructPermissionSet = function (session, callback) {

  var _this = this;

  if (session.isToken){ //we are dealing with a decoded token

    _this.securityService.getUser(session.username, function(e, user){

      if (e) return callback(e);

      identity = {user:user};
      identity.permissionSetKey = _this.securityService.generatePermissionSetKey(user);

      _this.__loadPermissionSet(identity, callback);
    });
  } else {
    _this.__loadPermissionSet(session, callback);
  }
}

CheckPoint.prototype.initialize = function (config, securityService, callback) {
  var _this = this;
  try {
    _this.securityService = securityService;
    _this.securityService.onDataChanged(_this.securityDirectoryChanged.bind(_this));
    callback();
  } catch (e) {
    callback(e);
  }
};

CheckPoint.prototype.__checkInactivity = function(session){

  var _this = this;

  function getTimeoutFunc(){
    return setTimeout(function(){
      delete _this.__inactivityCounters[this.id]; //perform seppuku
    }.bind(session), session.inactivity_threshold)
  }

  if (!this.__inactivityCounters[session.id]){

    if (Date.now() - session.timestamp <= session.inactivity_threshold){

      this.__inactivityCounters[session.id] = getTimeoutFunc();
      return true;

    } else return false;

  }else{

    clearTimeout(this.__inactivityCounters[session.id]);// a temporary reprieve
    this.__inactivityCounters[session.id] = getTimeoutFunc(); //re-gird the sacrificial dagger
    return true;

  }
};

CheckPoint.prototype.__checkUsageLimit = function(session){

  if (this.__usageLimitCounters[session.id] == undefined) this.__usageLimitCounters[session.id] = 0;
  this.__usageLimitCounters[session.id]++;

  if (this.__usageLimitCounters[session.id] > session.usage_limit) return false;
  else return true;

};

CheckPoint.prototype.__checkSessionPermissions = function(session, path, action){
  var permissionSet = this.__createPermissionSet(session.permissions);

  return this.__authorized(permissionSet, path, action);
};

CheckPoint.prototype._authorizeSession = function (session, path, action, callback) {

  try {

    var _this = this;

    if (session.expires > 0 && (session.expires + this.opts.expiry_grace) < Date.now()) return callback(new Error('expired session token'));

    if (session.inactivity_threshold > 0 && session.inactivity_threshold != Infinity && !_this.__checkInactivity(session)) return callback(new Error('session inactivity threshold reached'));

    if (session.usage_limit > 0 && session.usage_limit != Infinity && !_this.__checkUsageLimit(session)) return callback(new Error('session usage limit reached'));

    if (session.permissions && !_this.__checkSessionPermissions(session, path, action)) return callback(new Error('session permissions violated'));

    callback();

  } catch (e) {
    callback(e);
  }
};

CheckPoint.prototype._authorizeUser = function (session, path, action, callback) {

  try {

    var authorized = undefined;

    if (session.permissionSetKey) authorized = this.__permissionCache.get(session.permissionSetKey + path + action);

    if (authorized === undefined) {

      if (this.__permissionSets[session.permissionSetKey]) {

        authorized = this.__authorized(this.__permissionSets[session.permissionSetKey], path, action);
        this.__permissionCache.set(session.permissionSetKey + path + action, authorized);

        return callback(null, authorized);

      } else {

        var _this = this;

        _this.__constructPermissionSet(session, function (e, permissionSet) {

          if (e) return callback(e);

          authorized = _this.__authorized(permissionSet, path, action);
          _this.__permissionCache.set(session.permissionSetKey + path + action, authorized);

          return callback(null, authorized);

        });
      }

    } else {
      return callback(null, authorized);
    }

  } catch (e) {
    callback(e);
  }
};

CheckPoint.prototype.securityDirectoryChanged = function (whatHappnd, changedData) {

  this.__manifestID = Date.now();

  this.__permissionSets = {};//clear the permission set cache
  this.__permissionCache = LRU(this.opts.permissionCache);//clear permission cache

  return true;

};
