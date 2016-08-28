var jwt = require('jwt-simple')
  , uuid = require('node-uuid')
  , LRU = require("lru-cache")
  , sift = require('sift')
  ;

function AccessDenied(message) {

  this.name = 'AccessDenied';
  this.message = message;
}

AccessDenied.prototype = Error.prototype;

module.exports = SecurityService;

function SecurityService(opts) {

  this.log = opts.logger.createLogger('Security');
  this.log.$$TRACE('construct(%j)', opts);

  if (!opts.groupCache)
    opts.groupCache = {
      max: 300,
      maxAge: 0
    };

  if (!opts.userCache)
    opts.userCache = {
      max: 300,
      maxAge: 0
    };

  this.options = opts;

  this.__groupCache = LRU(this.options.groupCache);
  this.__userCache = LRU(this.options.userCache);
  this.__passwordCache = LRU(this.options.userCache);//alongside the user cache

}

SecurityService.prototype.AccessDeniedError = function (message) {

  return new AccessDenied(message);
};

SecurityService.prototype._ensureKeyPair = function (config, callback) {

  var _this = this;

  _this.dataService.get('/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR', {}, function (e, response) {

    if (e) return callback(e);

    if (!response) {

      if (!config.keyPair)
        config.keyPair = _this.cryptoService.serializeKeyPair(_this.cryptoService.createKeyPair());

      if (typeof config.keyPair != 'string')
        config.keyPair = _this.cryptoService.serializeKeyPair(config.keyPair);

      return _this.dataService.upsert('/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR', config.keyPair, {}, function (e, result) {

        if (e) return callback(e);

        _this._keyPair = _this.cryptoService.deserializeKeyPair(result.data.value);

        callback();
      });

    } else {

      try {
        _this._keyPair = _this.cryptoService.deserializeKeyPair(response.data.value);
      } catch (e) {

        var transformedKeyPair = _this.cryptoService.serializeKeyPair(_this.cryptoService.keyPairFromWIF(response.data.value));

        return _this.dataService.upsert('/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR', transformedKeyPair, {}, function (e, result) {

          if (e) return callback(e);
          _this._keyPair = _this.cryptoService.deserializeKeyPair(transformedKeyPair);
          callback();
        });

      }
    }

    callback();

  });
};

SecurityService.prototype._ensureAdminUser = function (config, callback) {

  var _this = this;

  if (!config.adminUser)
    config.adminUser = {
      custom_data: {}
    }

  if (!config.adminGroup)
    config.adminGroup = {
      custom_data: {description: 'the default administration group for happn'}
    }

  config.adminUser.username = '_ADMIN';
  config.adminGroup.name = '_ADMIN';

  config.adminGroup.permissions = {'*': {actions: ['*']}};

  _this.getUser('_ADMIN', function (e, foundUser) {

      if (e) return callback(e);

      if (foundUser) {
        return callback();
      } else {

        if (!config.adminUser.password) config.adminUser.password = 'happn';

        //group, options, callback
        _this.__upsertGroup(config.adminGroup, {}, function (e, adminGroup) {

          if (e) return callback(e);

          _this.__upsertUser(config.adminUser, {}, function (e, adminUser) {

            if (e) return callback(e);
            _this.linkGroup(adminGroup, adminUser, callback);

          });

        });

      }
    }
  );
};

SecurityService.prototype.initialize = function (config, callback) {
  try {

    this.dataService = this.happn.services.data;
    this.cryptoService = this.happn.services.crypto;

    this.pathField = this.dataService.pathField; //backward compatible for allowing mongo plugin, which uses an actual path field

    if (!config.tokenttl)
      config.tokenttl = 0;

    if (!config.sessionTokenSecret)
      config.sessionTokenSecret = uuid.v4() + uuid.v4();

    this.config = config;

    var _this = this;

    _this.__initializeProfiles(config, function (e) {

      if (e) return callback(e);

      _this._ensureKeyPair(config, function (e) {

        if (e) return callback(e);

        _this._ensureAdminUser(config, function (e) {

          if (e) return callback(e);

          var checkpoint = require('./checkpoint');
          _this.__checkpoint = new checkpoint({logger: _this.log});
          _this.__checkpoint.initialize(config, _this, function (e) {
            return callback();
          });

        });

      });
    });
  } catch (e) {
    callback(e);
  }
};

var __dataHooks = [];

SecurityService.prototype.offDataChanged = function (index) {
  delete __dataHooks[index];
};

SecurityService.prototype.onDataChanged = function (hook) {
  __dataHooks.push(hook);
  return __dataHooks.length - 1;
};

SecurityService.prototype.updateCaches = function (whatHappnd, changedData, additionalInfo) {


  if (whatHappnd == 'upsert-user') {
    this.__passwordCache.del(changedData.username);
    this.__userCache.del(changedData.username);
  }

  if (whatHappnd == 'delete-user') {
    this.__passwordCache.del(changedData.username);
    this.__userCache.del(changedData.username);
  }

  if (whatHappnd == 'upsert-group') {
    //clear users and passwords cache
    this.__userCache = LRU(this.options.userCache);
    this.__passwordCache = LRU(this.options.userCache);
  }

  if (whatHappnd == 'delete-group') {
    this.__groupCache.del(changedData.name);
    this.__userCache = LRU(this.options.userCache);
    this.__passwordCache = LRU(this.options.userCache);
  }

  if (whatHappnd == 'unlink-group') {
    //clear the user from the cache
    this.__userCache.del(additionalInfo.username);
    this.__passwordCache.del(additionalInfo.username);
  }

  if (whatHappnd == 'link-group') {
    //clear the user from the cache
    this.__userCache.del(additionalInfo.username);
    this.__passwordCache.del(additionalInfo.username);
  }


};

SecurityService.prototype.dataChanged = function (whatHappnd, changedData, additionalInfo) {

  this.updateCaches(whatHappnd, changedData, additionalInfo);

  var changedDataSerialized;

  if (changedData)
    changedDataSerialized = JSON.stringify(changedData);

  __dataHooks.every(function (hook) {
    if (changedDataSerialized) {
      return hook.apply(hook, [whatHappnd, JSON.parse(changedDataSerialized)]);
    } else {
      return hook.apply(hook, [whatHappnd]);
    }
  });
};

SecurityService.prototype.checkToken = function (token) {
  try {
    this.decodeToken(token);
    return true;
  } catch (e) {
    return false;
  }
};



SecurityService.prototype.decodeToken = function (token) {
  try {

    if (!token) throw new Error('missing session token');

    var decoded = jwt.decode(token, this.config.sessionTokenSecret);

    //we allow for a minute, in case the backend code takes a while to sync
    if (decoded.expires > 0 && decoded.expires + 60 < Date.now())
      throw new Error('expired session token');

    return decoded;

  } catch (e) {
    throw new Error('invalid session token');
  }
};

SecurityService.prototype.generatePermissionSetKey = function (user) {

  if (!user.groups) return '';

  return Object.keys(user.groups).reduce(function (key, groupName) {
    return key += '/' + groupName + '/';
  }, '');

};

SecurityService.prototype.generateEmptySession = function () {
  return {id: uuid.v4()};
};



/**
 takes a login trequest - and matches the request to a session, the session is then encoded with its associated policy
 into a JWT token - for stateless sessions
 */

SecurityService.prototype.__profileSession = function(session){
  var _this = this;

  for (var profileIndex in _this.__cache_Profiles) {

    var filter = _this.__cache_Profiles[profileIndex].session;
    var profileMatch = sift(filter, [session]);

    if (profileMatch.length == 1) return session.profile = profileIndex;

  }

  throw new Error('unable to match session with a profile');//this should never happen

};

SecurityService.prototype.generateToken = function (contents, callback) {

  jwt.encode(contents, this.config.sessionTokenSecret);

};

SecurityService.prototype.generateSession = function (user, callback) {

  var session = this.generateEmptySession();

  session.user = user;
  session.timestamp =  Date.now();

  //TODO - THIS IS AN ISSUE - WHAT IF PERMISSIONS CHANGE
  //PubSubService.prototype.securityDirectoryChanged
  //TODO - we want a really small token

  this.__profileSession(session);//TODO: session ttl, activity threshold and user effective permissions are set here

  session.permissionSetKey = this.generatePermissionSetKey(session.user, session);

  session.token = this.generateToken({

    id: session.id,
    isToken:true,
    username: user.username,
    timestamp: session.timestamp,
    ttl: session.ttl,
    permissions:session.permissions

  });

  // It is not possible for the login (websocket call) to assign the session token (cookie) server side,
  // so the cookie is therefore created in the browser upon login success.
  // It is necessary to include how to make the cookie in the login reply via this session object.
  if (this.config.cookieName) session.cookieName = this.config.cookieName;
  if (this.config.cookieDomain) session.cookieDomain = this.config.cookieDomain;

  if (user.publicKey) {
    //we can teleport a secret using assymetric cryptography, login payload is encrypted
    session.secret = require('shortid').generate();
    session.secretSalt = require('shortid').generate();

  }

  callback(null, session);

};

SecurityService.prototype.__validateName = function (name, validationType) {

  if (name && (name.indexOf('_SYSTEM') > -1 || name.indexOf('_GROUP') > -1 || name.indexOf('_PERMISSION') > -1 || name.indexOf('_USER_GROUP') > -1 || name.indexOf('_ADMIN') > -1))
    throw new Error('validation error: ' + validationType + ' names cannot contain the special _SYSTEM, _GROUP, _PERMISSION, _USER_GROUP, _ADMIN segment');

  if (name && (name.indexOf('/') > -1))
    throw new Error('validation error: ' + validationType + ' names cannot contain forward slashes');

};

SecurityService.prototype.__checkOverwrite = function(validationType, obj, path, name, options, callback){
  if (!name)
    name = obj.name;

  if (options && options.overwrite === false) {
    this.dataService.get(path, {}, function (e, result) {

      if (e) return callback(e);

      if (result)
        return callback(new Error('validation failure: ' + validationType + ' by the name ' + name + ' already exists'));

      callback();

    });
  } else
    return callback();
};

SecurityService.prototype.__validate = function (validationType, options, obj, callback) {

  var _this = this;

  if (validationType == 'user-group') {

    var group = options[0];
    var user = options[1];

    if (!group._meta)
      return callback(new Error('validation error: group does not exist or has not been saved'));

    if (!user._meta)
      return callback(new Error('validation error: user does not exist or has not been saved'));

    return _this.dataService.get(group._meta.path, {}, function (e, result) {

      if (e) return callback(e);

      if (!result)
        return callback(new Error('validation error: group does not exist: ' + group._meta.path));

      return _this.dataService.get(user._meta.path, {}, function (e, result) {

        if (e) return callback(e);

        if (!result)
          return callback(new Error('validation error: user does not exist: ' + user._meta.path));

        callback();

      });

    });

    return callback();
  }

  if (obj.name)//users, groups
    _this.__validateName(obj.name, validationType);

  if (validationType == 'user') {

    if (!obj.username)
      return callback(new Error('validation failure: no username specified'));

    if (!obj.password && !obj.publicKey) {
      return _this.dataService.get('/_SYSTEM/_SECURITY/_USER/' + obj.username, {}, function (e, result) {

        if (e) return callback(e);

        if (!result)
          return callback(new Error('validation failure: no password or publicKey specified for a new user'));

        _this.__checkOverwrite(validationType, obj, '/_SYSTEM/_SECURITY/_USER/' + obj.username, obj.username, options, callback);

      });
    }

    return _this.__checkOverwrite(validationType, obj, '/_SYSTEM/_SECURITY/_USER/' + obj.username, obj.username, options, callback);
  }

  if (validationType == 'group') {

    if (options.parent) {

      if (!options.parent._meta.path)
        return callback(new Error('validation error: parent group path is not in your request, have you included the _meta?'));
      //path, parameters, callback
      return _this.dataService.get(options.parent._meta.path, {}, function (e, result) {

        if (e) return callback(e);

        if (!result)
          return callback(new Error('validation error: parent group does not exist: ' + options.parent._meta.path));

        _this.__checkOverwrite(validationType, obj, options.parent._meta.path + '/' + obj.name,  obj.name, options, callback);

      });
    }

    return _this.__checkOverwrite(validationType, obj, '/_SYSTEM/_SECURITY/_GROUP/' + obj.name,  obj.name, options, callback);
  }

  if (validationType == 'permission') {

    var permission = options[0];
    var permissionGroup = options[1];

    if (!permissionGroup)
      return callback(new Error('validation error: you need a group to add a permission to'));

    if (!permissionGroup._meta.path)
      return callback(new Error('validation error: permission group path is not in your request, have you included the _meta?'));

    return _this.dataService.get(permissionGroup._meta.path, {}, function (e, result) {

      if (e) return callback(e);

      if (!result)
        return callback(new Error('validation error: permission group does not exist: ' + permissionGroup._meta.path));

      callback();

    });
  }

  return callback(new Error('Unknown validation type: ' + validationType));
};

SecurityService.prototype.getPasswordHash = function (username, callback) {
  var hash = this.__passwordCache.get(username);

  if (hash) return callback(null, hash);

  this.dataService.get('/_SYSTEM/_SECURITY/_USER/' + username, function (e, user) {

    if (e) return callback(e);

    if (!user) return callback(new Error(username + ' does not exist in the system'));

    this.__passwordCache.set(user.data.username, hash);

    callback(null, user.data.password);

  }.bind(this));
};

//so external services can use this
SecurityService.prototype.matchPassword = function (password, hash, callback) {
  this.cryptoService.verifyHash(password, hash, callback);
};

SecurityService.prototype.__cache_Profile;

SecurityService.prototype.__initializeProfiles = function(config, callback){

  if (!config.profiles) config.profiles = [];

  config.profiles.push({
    name:"default-stateful",// this is the default underlying profile for stateful sessions
    session:{
      type:{$eq:1}
    },
    policy: {
      ttl: Infinity,
      inactivity_threshold:Infinity
    }
  });

  config.profiles.push({
    name:"default-stateless",// this is the default underlying profile for ws sessions
    session:{
      type:{$eq:0}
    },
    policy: {
      ttl: 60000 * 10,//session goes stale after 10 minutes
      inactivity_threshold:Infinity
    }
  });

  this.__cache_Profiles = config.profiles;

  callback();

};

SecurityService.prototype.__cache_Nonce = {};

SecurityService.prototype.__generateNonce = function(publicKey, callback){

};

SecurityService.prototype.__checkDigest = function(credentials, user, callback){

};

SecurityService.prototype.__loginOK = function(credentials, user, callback){

  delete user['password'];

  if (credentials.publicKey) user.publicKey = credentials.publicKey;

  return this.generateSession(user, callback);
};

SecurityService.prototype.login = function (credentials, callback) {

  var _this = this;

  if (credentials.username && (credentials.password || credentials.digest)) {

    return _this.getUser(credentials.username, function (e, user) {

      if (e) return callback(e);
      if (user == null) return callback(_this.AccessDeniedError('Invalid credentials'));

      if (credentials.digest){

        return _this.__checkDigest(credentials, user, function(e, valid){

          if (e) return callback(e);

          if (!valid) return callback(_this.AccessDeniedError('Invalid credentials'));

          return _this.__loginOK(credentials, user, callback);

        });
      }

      _this.getPasswordHash(credentials.username, function (e, hash) {

        if (e) return callback(e);

        _this.matchPassword(credentials.password, hash, function (e, match) {

          if (e) return callback(e);

          if (!match) return callback(_this.AccessDeniedError('Invalid credentials'));

          return _this.__loginOK(credentials, user, callback);

        });

      });

    });
  }
  else
    callback(_this.AccessDeniedError('Invalid credentials'));

};

SecurityService.prototype.serializeAll = function (objectType, objArray, options) {

  var _this = this;

  if (!objArray)
    return [];

  return objArray

    .map(function (obj) {
      return _this.serialize(objectType, obj, options);
    })

};

SecurityService.prototype.serialize = function (objectType, obj) {

  var returnObj = this.happn.utils.clone(obj.data);
  returnObj._meta = obj._meta;

  if (objectType == 'user')
    delete returnObj['password'];

  return returnObj;
};

SecurityService.prototype.__prepareUser = function (user, options, callback) {

  var clonedUser = this.happn.utils.clone(user);//we are passing the back to who knows where and it lives here in the cache...

  if (user.password) {

    return this.cryptoService.generateHash(user.password, function (e, hash) {

      if (e) return callback(e);

      clonedUser.password = hash;
      callback(null, clonedUser);

    });

  } else {
    callback(null, clonedUser);
  }

}

SecurityService.prototype.__upsertUser = function (user, options, callback) {

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
      _this.dataChanged('upsert-user', upserted, prepared);

      callback(null, upserted);

    });

  });
};

SecurityService.prototype.upsertUser = function (user, options, callback) {

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

SecurityService.prototype.deleteUser = function (user, options, callback) {

  if (typeof options == 'function') callback = options;

  var _this = this;
  var userPath = '/_SYSTEM/_SECURITY/_USER/' + user.username;
  var userTree = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/*';

  _this.dataService.remove(userPath, {}, function (e, result1) {

    if (e) return callback(e);

    _this.dataService.remove(userTree, {}, function (e, result2) {

      if (e) return callback(e);

      var deleted = {obj: result1, tree: result2};

      _this.__userCache.del(user.username);
      _this.__passwordCache.del(user.username);

      _this.dataChanged('delete-user', deleted);

      return callback(null, deleted);

    });
  });

};

SecurityService.prototype.__decodeGroupPermissions = function (group) {

  var parsedPermissions = {};

  for (var permissionKey in group.permissions) {
    parsedPermissions[permissionKey.replace(/\\u002e/, ".")] = group.permissions[permissionKey];
  }

  group.permissions = parsedPermissions;

  return group;

};

SecurityService.prototype.__encodeGroupPermissions = function (group) {

  var parsedPermissions = {};

  for (var permissionKey in group.permissions) {
    parsedPermissions[permissionKey.replace(/\./g, "\\u002e")] = group.permissions[permissionKey];
  }

  group.permissions = parsedPermissions;

  return group;

};

SecurityService.prototype.__upsertGroup = function (group, options, callback) {

  var groupPath;

  if (options.parent)//we have checked in __validate
    groupPath = options.parent._meta.path + '/' + group.name;
  else
    groupPath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;

  this.dataService.upsert(groupPath, group, {merge: true}, function (e, result) {
    if (e) return callback(e);

    var upserted = this.serialize('group', result, options);

    this.__groupCache.del(group.name);
    this.dataChanged('upsert-group', upserted);

    callback(null, upserted);

  }.bind(this));

};

SecurityService.prototype.upsertGroup = function (group, options, callback) {

  if (typeof options == 'function') {
    callback = options;
  }

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

SecurityService.prototype.deleteGroup = function (group, options, callback) {
  var _this = this;

  if (typeof options == 'function')
    callback = options;

  _this.getGroup(group.name, {}, function (e, group) {

    if (e) return callback(e);

    if (!group) return callback(new Error('group you are deleting does not exist'));

    var deletePath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;
    try {
      _this.dataService.remove(deletePath, {}, function (e, groupDeleteResults) {
        if (e) return callback(e);

        deletePath = '/_SYSTEM/_SECURITY/_USER/*/_USER_GROUP/' + group.name + '/*';
        _this.dataService.remove(deletePath, {}, function (e, userGroupDeleteResults) {
          if (e) return callback(e);

          var deleted = {removed: groupDeleteResults.data.removed, obj: group, links: userGroupDeleteResults};
          _this.dataChanged('delete-group', deleted);

          return callback(null, deleted);
        });
      });
    } catch (e) {
      callback(e);
    }
  });
};

SecurityService.prototype.listGroups = function (groupName, options, callback) {

  if (typeof options == 'function')
    callback = options;

  if (typeof groupName == 'function') {
    callback = groupName;
    groupName = '*';
  }

  if (groupName[groupName.length - 1] != '*')
    groupName += '*';

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

SecurityService.prototype.getGroup = function (groupName, options, callback) {

  if (typeof options == 'function')
    callback = options;

  groupName = groupName.replace(/[*]/g, '');
  var searchPath = '/_SYSTEM/_SECURITY/_GROUP/' + groupName;

  try {

    var cachedGroup = this.__groupCache.get(groupName);

    //we are passing the cached object back, possibly as an unserialized reference - clone to avoid modification
    if (cachedGroup) return callback(null, this.happn.utils.clone(cachedGroup));

    this.dataService.get(searchPath, {sort: this.pathField}, function (e, result) {

      if (e) return callback(e);

      if (result) {

        var group = this.__decodeGroupPermissions(this.serialize('group', result, options));

        //add the group to the cache TODO: implement LRU cache service here
        this.__groupCache.set(groupName, group);

        //we are passing the cached object back, possibly as an unserialized reference - clone to avoid modification
        callback(null, this.happn.utils.clone(group));

      } else callback(null, null);

    }.bind(this));

  } catch (e) {
    callback(e);
  }
};

SecurityService.prototype.getUser = function (userName, options, callback) {
  var _this = this;

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  userName = userName.replace(/[*]/g, '');
  var userPath = '/_SYSTEM/_SECURITY/_USER/' + userName;
  var searchPath = userPath + '*';

  try {

    var cachedUser = _this.__userCache.get(userName);

    //we are passing the cached object back, possibly as an unserialized reference - clone to avoid modification
    if (cachedUser) return callback(null, _this.happn.utils.clone(cachedUser));

    _this.dataService.get(searchPath, {sort: this.pathField}, function (e, results) {

      if (e) return callback(e);

      if (results.length > 0) {

        var user;
        var groups = {};

        results.every(function (userItem, userItemIndex) {

          if (userItem.data && userItem.data.username) {
            user = userItem;
          }
          else {
            var userGroupItem = results[userItemIndex];
            if (userGroupItem._meta.path.indexOf(userPath + '/') == 0)
              groups[userGroupItem._meta.path.replace(userPath + '/_USER_GROUP/', '')] = userGroupItem;
          }

          return true;
        });

        var returnUser = _this.serialize('user', user, options);

        if (groups) returnUser.groups = groups;

        //update the caches, passwords are cached alongside the user for optimised authorization without exposing the hashes
        _this.__userCache.set(userName, returnUser);
        _this.__passwordCache.set(userName, returnUser.password);

        //we are passing the cached object back, possibly as an unserialized reference - clone to avoid modification
        callback(null, _this.happn.utils.clone(returnUser));
      }
      else
        callback(null, null);

    });

  } catch (e) {
    callback(e);
  }
};

SecurityService.prototype.__removeGroupLinks = function(userItems){
  var usersList = [];

  for (var itemIndex in userItems){

    var userItem = userItems[itemIndex];
    if (userItem._meta[this.pathField].indexOf('_USER_GROUP') >= 0) continue;
    usersList.push(userItem);

  }

  return usersList;
};

SecurityService.prototype.listUsers = function (userName, options, callback) {

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

SecurityService.prototype.linkGroup = function (group, user, options, callback) {

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
        _this.dataChanged('link-group', upserted, user);

        callback(null, upserted);

      });
    });
  } catch (e) {
    callback(e);
  }
};

SecurityService.prototype.unlinkGroup = function (group, user, options, callback) {

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

        _this.dataChanged('unlink-group', groupLinkPath, user);
        callback(null, result);
      });
    });
  } catch (e) {
    callback(e);
  }
};

SecurityService.prototype.authorize = function (session, path, action, callback) {

  var _this = this;

  _this.__checkpoint._authorizeSession(session, function(e){//check the session ttl, expiry,permissions etc.

    if (e) return callback(e);
    _this.__checkpoint._authorizeUser(session, path, action, callback);//authorize the underlying session user

  });
};

SecurityService.prototype.safe = function () {
  var _this = this;

  return {
    login: _this.login.bind(_this),
    generateSession: _this.generateSession.bind(_this),
    checkToken: _this.checkToken.bind(_this),
    authorize: _this.authorize.bind(_this),
    AccessDeniedError: _this.AccessDeniedError.bind(_this),
    onDataChanged: _this.onDataChanged.bind(_this),
    offDataChanged: _this.offDataChanged.bind(_this),
    generatePermissionSetKey: _this.generatePermissionSetKey.bind(_this),
    generateEmptySession: _this.generateEmptySession.bind(_this)
  }
};
