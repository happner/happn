
var Promise = require('bluebird');

function SecurityUsers(opts) {

  this.log = opts.logger.createLogger('SecurityUsers');
  this.log.$$TRACE('construct(%j)', opts);

  this.opts = opts;
}

SecurityUsers.prototype.initialize = Promise.promisify(function (config, securityService, callback) {

  var _this = this;

  try {

    _this.securityService = securityService;

    _this.cacheService =  _this.happn.services.cache;
    _this.dataService =  _this.happn.services.data;

    //backward compatible for allowing mongo plugin, which uses an actual path field
    _this.pathField = _this.dataService.pathField;
    _this.utilsService =  _this.happn.services.utils;
    _this.errorService =  _this.happn.services.error;
    _this.cryptoService =  _this.happn.services.crypto;
    _this.sessionService =  _this.happn.services.session;

    if (!config.__cache_groups) config.__cache_groups = {type:'LRU', cache:{max: 1000, maxAge: 0}};
    if (!config.__cache_users) config.__cache_users = {type:'LRU', cache:{max: 1000, maxAge: 0}};

    _this.__cache_groups = _this.cacheService.new('cache_security_groups',  config.__cache_groups);
    _this.__cache_users = _this.cacheService.new('cache_security_users',  config.__cache_users);
    _this.__cache_passwords = _this.cacheService.new('cache_security_passwords',  config.__cache_users);

    _this.securityService.onDataChanged(_this.securityDirectoryChanged.bind(_this));

    callback();

  } catch (e) {
    callback(e);
  }
});

SecurityUsers.prototype.clearCaches = function (whatHappnd, changedData, additionalInfo, callback) {

  var _this = this;

  _this.__cache_passwords.clear()
    .then(_this.__cache_users.clear()
      .then(_this.__cache_groups.clear()
        .then(callback)))
    .catch(callback);
};

SecurityUsers.prototype.__validateName = function (name, validationType) {

  if (!name) throw new this.errorService.ValidationError('names cannot be empty');

  if (this.utilsService.stringContainsAny(name, ['/','_SYSTEM','_GROUP','_PERMISSION','_USER_GROUP','_ADMIN']))
    throw new this.errorService.ValidationError('validation error: ' + validationType + ' names cannot contain the special _SYSTEM, _GROUP, _PERMISSION, _USER_GROUP, _ADMIN segment or a forward slash /');

};

SecurityUsers.prototype.__checkOverwrite = function(validationType, obj, path, name, options, callback){

  if (!name) name = obj.name;

  if (options && options.overwrite === false) {

    this.dataService.get(path, {}, function (e, result) {

      if (e) return callback(e);

      if (result) return callback(new Error('validation failure: ' + validationType + ' by the name ' + name + ' already exists'));

      callback();
    });
  } else return callback();
};

SecurityUsers.prototype.__validate = function (validationType, options, obj, callback) {

  var _this = this;

  if (validationType == 'user-group') {

    var group = options[0];
    var user = options[1];

    if (!group._meta) return callback(new Error('validation error: group does not exist or has not been saved'));

    if (!user._meta) return callback(new Error('validation error: user does not exist or has not been saved'));

    return _this.dataService.get(group._meta.path, {}, function (e, result) {

      if (e) return callback(e);

      if (!result) return callback(new Error('validation error: group does not exist: ' + group._meta.path));

      return _this.dataService.get(user._meta.path, {}, function (e, result) {

        if (e) return callback(e);

        if (!result) return callback(new Error('validation error: user does not exist: ' + user._meta.path));

        callback();

      });
    });

    return callback();
  }

  if (obj.name) _this.__validateName(obj.name, validationType);

  if (validationType == 'user') {

    if (!obj.username) return callback(new Error('validation failure: no username specified'));

    if (!obj.password && !obj.publicKey) {

      return _this.dataService.get('/_SYSTEM/_SECURITY/_USER/' + obj.username, {}, function (e, result) {

        if (e) return callback(e);

        if (!result) return callback(new Error('validation failure: no password or publicKey specified for a new user'));

        _this.__checkOverwrite(validationType, obj, '/_SYSTEM/_SECURITY/_USER/' + obj.username, obj.username, options, callback);
      });
    }
    return _this.__checkOverwrite(validationType, obj, '/_SYSTEM/_SECURITY/_USER/' + obj.username, obj.username, options, callback);
  }

  if (validationType == 'group') {

    if (options.parent) {

      if (!options.parent._meta.path) return callback(new Error('validation error: parent group path is not in your request, have you included the _meta?'));
      //path, parameters, callback
      return _this.dataService.get(options.parent._meta.path, {}, function (e, result) {

        if (e) return callback(e);

        if (!result) return callback(new Error('validation error: parent group does not exist: ' + options.parent._meta.path));

        _this.__checkOverwrite(validationType, obj, options.parent._meta.path + '/' + obj.name,  obj.name, options, callback);

      });
    }
    return _this.__checkOverwrite(validationType, obj, '/_SYSTEM/_SECURITY/_GROUP/' + obj.name,  obj.name, options, callback);
  }

  if (validationType == 'permission') {

    var permission = options[0];
    var permissionGroup = options[1];

    if (!permissionGroup) return callback(new Error('validation error: you need a group to add a permission to'));
    if (!permissionGroup._meta.path) return callback(new Error('validation error: permission group path is not in your request, have you included the _meta?'));

    return _this.dataService.get(permissionGroup._meta.path, {}, function (e, result) {

      if (e) return callback(e);

      if (!result) return callback(new Error('validation error: permission group does not exist: ' + permissionGroup._meta.path));

      callback();
    });
  }

  return callback(new Error('Unknown validation type: ' + validationType));
};

SecurityUsers.prototype.getPasswordHash = function (username, callback) {

  var _this = this;

  _this.__cache_passwords.get(username, function(e, hash){

    if (e) return callback(e);

    if (hash) return callback(null, hash);

    _this.dataService.get('/_SYSTEM/_SECURITY/_USER/' + username, function (e, user) {

      if (e) return callback(e);

      if (!user) return callback(new Error(username + ' does not exist in the system'));

      _this.__cache_passwords.set(user.data.username, user.data.password, function(e){

        if (e) return callback(e);

        callback(null, user.data.password);
      });

    }.bind(this));
  });
};

SecurityUsers.prototype.serializeAll = function (objectType, objArray, options) {

  var _this = this;

  if (!objArray) return [];

  return objArray

    .map(function (obj) {
      return _this.serialize(objectType, obj, options);
    })

};

SecurityUsers.prototype.serialize = function (objectType, obj) {

  var returnObj = this.utilsService.clone(obj.data);

  returnObj._meta = obj._meta;

  if (objectType == 'user') delete returnObj['password'];

  return returnObj;
};

/**
 * Clones the passed in user, and generates a hash of the users password to be pushed into the data store.
 */
SecurityUsers.prototype.__prepareUser = function (user, options, callback) {

  var clonedUser = this.utilsService.clone(user);//we are passing the back to who knows where and it lives here in the cache...

  if (user.password) {

    return this.cryptoService.generateHash(user.password, function (e, hash) {

      if (e) return callback(e);

      clonedUser.password = hash;
      callback(null, clonedUser);

    });

  } else {
    callback(null, clonedUser);
  }
};

SecurityUsers.prototype.__upsertUser = function (user, options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
  }

  _this.__prepareUser(user, options, function (e, prepared) {

    if (e) return callback(e);

    var userPath = '/_SYSTEM/_SECURITY/_USER/' + prepared.username;

    _this.dataService.upsert(userPath, prepared, {merge: true}, function (e, result) {

      if (e) return callback(e);

      var upserted = _this.serialize('user', result);

      _this.securityService.dataChanged('upsert-user', upserted, prepared);

      callback(null, upserted);

    });
  });
};

SecurityUsers.prototype.upsertUser = function (user, options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
  }

  try {
    _this.__validate('user', options, user, function (e) {
      if (e) return callback(e);

      _this.__upsertUser(user, options, callback);
    });
  } catch (e) {
    callback(e);
  }
};

SecurityUsers.prototype.deleteUser = function (user, options, callback) {

  if (typeof options == 'function') callback = options;

  var _this = this;

  var userPath = '/_SYSTEM/_SECURITY/_USER/' + user.username;
  var userTree = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/*';

  _this.dataService.remove(userPath, {}, function (e, result1) {

    if (e) return callback(e);

    _this.dataService.remove(userTree, {}, function (e, result2) {

      if (e) return callback(e);

      var deleted = {obj: result1, tree: result2};

      _this.__cache_users.remove(user.username)

        .then(_this.__cache_passwords.remove(user.username)

          .then(function(){

            _this.securityService.dataChanged('delete-user', deleted);
            callback(null, deleted);
          }))

        .catch(callback);

    });
  });
};

SecurityUsers.prototype.__decodeGroupPermissions = function (group) {

  var parsedPermissions = {};

  for (var permissionKey in group.permissions) {
    parsedPermissions[permissionKey.replace(/\\u002e/, ".")] = group.permissions[permissionKey];
  }

  group.permissions = parsedPermissions;

  return group;

};

SecurityUsers.prototype.__encodeGroupPermissions = function (group) {

  var parsedPermissions = {};

  for (var permissionKey in group.permissions) {
    parsedPermissions[permissionKey.replace(/\./g, "\\u002e")] = group.permissions[permissionKey];
  }

  group.permissions = parsedPermissions;

  return group;

};

SecurityUsers.prototype.__upsertGroup = function (group, options, callback) {

  var groupPath;

  if (options.parent) groupPath = options.parent._meta.path + '/' + group.name;
  else groupPath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;

  var _this = this;

  _this.dataService.upsert(groupPath, group, {merge: true}, function (e, result) {

    if (e) return callback(e);

    var upserted = _this.serialize('group', result);

    _this.securityService.dataChanged('upsert-group', upserted);

    callback(null, upserted);

  }.bind(this));

};

SecurityUsers.prototype.upsertGroup = function (group, options, callback) {

  if (typeof options == 'function') callback = options;

  var preparedGroup = this.__encodeGroupPermissions(group);
  //TODO: this was done, but the variable never used - now testing using it
  try {
    this.__validate('group', options, preparedGroup, function (e) {
      if (e) return callback(e);
      this.__upsertGroup(preparedGroup, options, callback);
    }.bind(this));
  } catch (e) {
    callback(e);
  }
};

SecurityUsers.prototype.deleteGroup = function (group, options, callback) {

  var _this = this;

  if (typeof options == 'function') callback = options;

  _this.getGroup(group.name, {}, function (e, group) {

    if (e) return callback(e);

    if (!group) return callback(new Error('group you are deleting does not exist'));

    var deletePath = '/_SYSTEM/_SECURITY/_USER/*/_USER_GROUP/' + group.name + '/*';

    try {

      _this.dataService.remove(deletePath, {}, function (e, userGroupDeleteResults) {

        if (e) return callback(e);

        deletePath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;

        _this.dataService.remove(deletePath, {}, function (e, groupDeleteResults) {

          if (e) return callback(e);

          var deleted = {removed: groupDeleteResults.data.removed, obj: group, links: userGroupDeleteResults};

          _this.securityService.dataChanged('delete-group', deleted);

          return callback(null, deleted);

        });
      });
    } catch (e) {
      callback(e);
    }
  });
};

SecurityUsers.prototype.listGroups = function (groupName, options, callback) {

  if (typeof options == 'function') callback = options;

  if (typeof groupName == 'function') {
    callback = groupName;
    groupName = '*';
  }

  if (groupName[groupName.length - 1] != '*') groupName += '*';

  var searchPath = '/_SYSTEM/_SECURITY/_GROUP/' + groupName

  try {

    this.dataService.get(searchPath, {sort: this.pathField}, function (e, results) {
      if (e) return callback(e);

      callback(null, this.serializeAll('group', results, options));
    }.bind(this));
  } catch (e) {

    callback(e);
  }
};

SecurityUsers.prototype.getGroup = function (groupName, options, callback) {

  if (typeof options == 'function') callback = options;

  groupName = groupName.replace(/[*]/g, '');

  var searchPath = '/_SYSTEM/_SECURITY/_GROUP/' + groupName;
  var _this = this;

  try {

    _this.__cache_groups.get(groupName, function(e, cachedGroup){

      if (e) return callback(e);
      if (cachedGroup) return callback(null, cachedGroup);

      _this.dataService.get(searchPath, {sort: _this.pathField}, function (e, result) {

        if (e) return callback(e);

        if (result) {

          var group = _this.__decodeGroupPermissions(_this.serialize('group', result, options));

          //add the group to the cache TODO: implement LRU cache service here
          _this.__cache_groups.set(groupName, group)
            .then(callback(null, group))
            .catch(callback);

        } else callback(null, null);

      });
    });

  } catch (e) {
    callback(e);
  }
};

SecurityUsers.prototype.getUser = function (userName, options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  userName = userName.replace(/[*]/g, '');
  var userPath = '/_SYSTEM/_SECURITY/_USER/' + userName;
  var searchPath = userPath + '*';

  try {

    _this.__cache_users.get(userName, function(e, cachedUser){

      if (cachedUser) return callback(null, cachedUser);

      _this.dataService.get(searchPath, {sort: this.pathField}, function (e, results) {

        if (e) return callback(e);

        if (results.length > 0) {

          var user;
          var groups = {};

          results.forEach(function (userItem, userItemIndex) {

            if (userItem.data && userItem.data.username) return user = userItem;

            //we have found a group, add the group, by its name to the groups object
            if (results[userItemIndex]._meta.path.indexOf(userPath + '/') == 0)
              groups[results[userItemIndex]._meta.path.replace(userPath + '/_USER_GROUP/', '')] = results[userItemIndex];

          });

          var returnUser = _this.serialize('user', user, options);

          if (groups) returnUser.groups = groups;

          //update the caches, passwords are cached alongside the user for optimised authorization without exposing the hashes
          _this.__cache_users.set(userName, returnUser)
            .then(_this.__cache_passwords.set(userName, returnUser.password))
            .then(callback(null, returnUser))
            .catch(callback);
        }
        else callback(null, null);
      });
    });

  } catch (e) {
    callback(e);
  }
};

SecurityUsers.prototype.__removeGroupLinks = function(userItems){
  var usersList = [];

  for (var itemIndex in userItems){

    var userItem = userItems[itemIndex];
    if (userItem._meta[this.pathField].indexOf('_USER_GROUP') >= 0) continue;
    usersList.push(userItem);

  }

  return usersList;
};

SecurityUsers.prototype.listUsers = function (userName, options, callback) {

  if (typeof options == 'function')
    callback = options;

  if (typeof userName == 'function') {
    callback = groupName;
    userName = '*';
  }

  if (userName[userName.length - 1] != '*')
    userName += '*';

  var searchPath = '/_SYSTEM/_SECURITY/_USER/' + userName;

  try {

    this.dataService.get(searchPath, {}, function (e, results) {

      if (e) return callback(e);

      var users = this.__removeGroupLinks(results);//had to do this to be compatible with mongo

      callback(null, this.serializeAll('user', users, options));

    }.bind(this));

  } catch (e) {
    callback(e);
  }
};

SecurityUsers.prototype.linkGroup = function (group, user, options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  try {

    _this.__validate('user-group', [group, user], options, function (e) {

      if (e) return callback(e);

      var groupLinkPath = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name;

      _this.dataService.upsert(groupLinkPath, options, {merge: true}, function (e, result) {

        if (e) return callback(e);

        var upserted = _this.serialize('user-group', result, options);

        _this.securityService.dataChanged('link-group', upserted, user);

        callback(null, upserted);
      });
    });
  } catch (e) {
    callback(e);
  }
};

SecurityUsers.prototype.unlinkGroup = function (group, user, options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  try {

    _this.__validate('user-group', [group, user], null, function (e) {

      if (e) return callback(e);

      var groupLinkPath = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name;

      _this.dataService.remove(groupLinkPath, {}, function (e, result) {

        if (e) return callback(e);

        _this.securityService.dataChanged('unlink-group', groupLinkPath, user);

        callback(null, result);
      });
    });
  } catch (e) {
    callback(e);
  }
};

SecurityUsers.prototype.securityDirectoryChanged = function (whatHappnd, changedData) {

  var _this = this;

  if (['link-group', 'unlink-group', 'delete-user', 'delete-group'].indexOf(whatHappnd) > -1) {

    _this.sessionService.each(function (sessionData, sessionCallback) {

      try{

        if (!sessionData.user) return sessionCallback();

        var doUpdate = false;

        if (whatHappnd == 'link-group') {

          if (changedData._meta.path.indexOf('/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/') == 0) {

            var groupName = changedData._meta.path.replace('/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/', '');

            sessionData.user.groups[groupName] = changedData;
            sessionData.permissionSetKey = _this.securityService.generatePermissionSetKey(sessionData.user);

            doUpdate = true;
          }
        }

        if (whatHappnd == 'unlink-group') {

          if (changedData.indexOf('/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/') == 0) {

            var groupName = changedData.replace('/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/', '');
            delete sessionData.user.groups[groupName];

            sessionData.permissionSetKey = _this.securityService.generatePermissionSetKey(sessionData.user);
            doUpdate = true;
          }
        }

        if (whatHappnd == 'delete-user') {

          var userName = changedData.obj._meta.path.replace('/_SYSTEM/_SECURITY/_USER/', '');

          if (sessionData.user.username == userName) {
            _this.sessionService.disconnectSession(sessionData.id, {reason:'security directory update: user deleted'});

            doUpdate = true;
          }
        }

        if (whatHappnd == 'delete-group') {

          if (sessionData.user.groups[changedData.obj.name]) {
            delete sessionData.user.groups[changedData.obj.name];
            sessionData.permissionSetKey = _this.securityService.generatePermissionSetKey(sessionData.user);

            doUpdate = true;
          }
        }

        sessionCallback(null, doUpdate);

      }catch(e){
        sessionCallback(e);
      }

    }, function(e){
      if (e) return _this.happn.services.error.handleFatal('failure updating sessionData security data', e, 'security users');
    });
  }

  // if (whatHappnd == 'session-management-activated'){
  //   this.__syncSessions();
  // }

  return true;
};

module.exports = SecurityUsers;
