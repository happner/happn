var jwt = require('jwt-simple');
var moment = require('moment');
var shortid = require('shortid');
var bitcore = require('bitcore-lib');
var ECIES = require('bitcore-ecies');
var symmetricalCrypto = require('password-hash-and-salt');
var LRU = require("lru-cache");

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
        max: 1000,
        maxAge: 0
    }

    if (!opts.userCache)
    opts.userCache = {
        max: 1000,
        maxAge: 0
    }

    this.options = opts;

    this.__groupCache = LRU(this.options.groupCache);
    this.__userCache = LRU(this.options.userCache);
    this.__passwordCache = LRU(this.options.userCache);//alongside the user cache
}

// SecurityService.prototype.__groupCache = function(){
//     return this.__groupCache;
// }

SecurityService.prototype.AccessDeniedError = function(message){
    return new AccessDenied(message);
}

SecurityService.prototype._ensureKeyPair = function(config, callback){
    var _this = this;

    _this.dataService.get('/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR', {}, function(e, response){

        if (e) return callback(e);

        if (!response){

            if (!config.keyPair)
                config.keyPair = _this.serializeKeyPair(_this.generateKeyPair());

            return _this.dataService.upsert('/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR', config.keyPair, {}, function(e, result){

                 if (e) return callback(e);

                 _this._keyPair = _this.deserializeKeyPair(result.data.value);

                 callback();
            });

        }else{
            _this._keyPair = _this.deserializeKeyPair(response.data.value);
        }

        callback();

    });
}

SecurityService.prototype._ensureAdminUser = function(config, callback){
    var _this = this;

    if (!config.adminUser)
    config.adminUser = {
        custom_data:{}
    }

    if (!config.adminGroup)
    config.adminGroup = {
        custom_data:{description:'the default administration group for happn'}
    }

    config.adminUser.username = '_ADMIN';
    config.adminGroup.name = '_ADMIN';

    config.adminGroup.permissions = {'/*':{actions:['*']}};

    _this.getUser('_ADMIN', function(e, foundUser){

          if (e) return callback(e);

          if (foundUser){

            if (config.adminUser.password){

                foundUser.password = config.adminUser.password;
                return _this.__upsertUser(foundUser, {}, callback);

            }else
                return callback();

          }else{

            if (!config.adminUser.password)
                config.adminUser.password = 'happn';

            //group, options, callback
            _this.__upsertGroup(config.adminGroup, {}, function(e, adminGroup){

                if (e) return callback(e);

                _this.__upsertUser(config.adminUser, {}, function(e, adminUser){

                     if (e) return callback(e);
                     _this.linkGroup(adminGroup, adminUser, callback);

                });

            });

          }
        }
    );
}

SecurityService.prototype.initialize = function(config, done){
    try{

        this.dataService = this.happn.services.data;
       
        if (!config.tokenttl)
            config.tokenttl = 0;

        if (!config.sessionTokenSecret)
           config.sessionTokenSecret = shortid.generate();

        if (!config.systemSecret)
            config.systemSecret = 'happn';

        this.config = config;
        
        var _this = this;
        
        _this._ensureKeyPair(config, function(e){

            if (e) return done(e);
            _this._ensureAdminUser(config, function(e){

                if (e) return done(e);

                var checkpoint = require('./checkpoint');
                _this.__checkpoint = new checkpoint({logger: _this.log});
                _this.__checkpoint.initialize(config, _this, function(e){
                    return done();
                });

            });

        });
    }catch(e){
        done(e);
    }
}

var __dataHooks = [];

SecurityService.prototype.offDataChanged = function(index){
    delete __dataHooks[index];
}

SecurityService.prototype.onDataChanged = function(hook){
    __dataHooks.push(hook);
    return __dataHooks.length - 1;
}

SecurityService.prototype.dataChanged = function(whatHappnd, changedData){
    var _this = this;
    __dataHooks.every(function(hook){
        if (changedData){
            var decoupled = _this.happn.utils.clone(changedData);
            return hook.apply(hook, [whatHappnd, decoupled]);
        }else{
            return hook.apply(hook, [whatHappnd]);
        }
    });
}

SecurityService.prototype.verifyHash = function(secret, hash, callback){
    symmetricalCrypto(secret).verifyAgainst(hash, callback);
}

SecurityService.prototype.generateHash = function(secret, callback){
    symmetricalCrypto(secret).hash(callback);
}

SecurityService.prototype.serializeKeyPair = function(keypair){
    return keypair.privateKey.toWIF();
}

SecurityService.prototype.deserializeKeyPair = function(string){
    var keyPair = {};
    var internalKeyPair = bitcore.PrivateKey.fromWIF(string);

    keyPair.privateKey = internalKeyPair;
    keyPair.publicKey = internalKeyPair.publicKey;

    return keyPair;
}

SecurityService.prototype.generateKeyPair = function(opts){

    var keyPair = {};

    var internalKeyPair = new bitcore.PrivateKey(opts);

    keyPair.privateKey = internalKeyPair;
    keyPair.publicKey = internalKeyPair.publicKey;

    return keyPair;
}

SecurityService.prototype.encryptAsymmetrical = function(privateKey, publicKey, message){
    return ECIES()
    .privateKey(privateKey)
    .publicKey(publicKey)
    .encrypt(message);
}

SecurityService.prototype.decryptAsymmetrical = function(privateKey, publicKey, message){
    return ECIES()
    .privateKey(privateKey)
    .publicKey(publicKey)
    .decrypt(message);
}

SecurityService.prototype.checkToken = function(token){
    try{
        this.decodeToken(token);
        return true;
    }catch(e){
        return false;
    }
}

SecurityService.prototype.decodeToken = function(token){
    try{

        if (!token)
            throw new Error('No authentication token was found in the request');
    
        var decoded = jwt.decode(token, this.config.sessionTokenSecret);
        
        //we allow for a minute, in case the backend code takes a while to sync
        if (decoded.expires > 0 && decoded.expires + 60 < moment().unix())
            throw new Error('Token has expired');

        
        return decoded;

    }catch(e){
        throw new Error('Authentication failed: ' + e.toString());
    }
}

SecurityService.prototype.generatePermissionSetKey = function(user){

    if (!user.groups) return '';

    return Object.keys(user.groups).reduce(function(key, groupName){
        return key += '/' + groupName + '/';
    }, '');

}

SecurityService.prototype.generateEmptySession = function(){
     return {id:shortid.generate()};
}

SecurityService.prototype.generateSession = function(user, callback){

    var session = this.generateEmptySession();
    session.user = user;

    var expiryTime = 0;
    var timestamp = moment().unix();

    if (this.config.tokenttl > 0)
        expiryTime = timestamp + (this.config.tokenttl * 60);
   
    session.timestamp = timestamp;
    session.expires = expiryTime;
    session.ttl = this.config.tokenttl;
    session.token = jwt.encode(session, this.config.sessionTokenSecret);
    session.permissionSetKey = this.generatePermissionSetKey(user);

    callback(null, session);
    
}

SecurityService.prototype.__validateName = function(name, validationType){

    if (name && (name.indexOf('_SYSTEM') > -1 || name.indexOf('_GROUP') > -1 || name.indexOf('_PERMISSION') > -1 || name.indexOf('_USER_GROUP') > -1 || name.indexOf('_ADMIN') > -1))
        throw new Error('validation error: ' + validationType + ' names cannot contain the special _SYSTEM, _GROUP, _PERMISSION, _USER_GROUP, _ADMIN segment');

    if (name && (name.indexOf('/') > -1))
        throw new Error('validation error: ' + validationType + ' names cannot contain forward slashes');

}

SecurityService.prototype.__validate = function(validationType, options, obj, callback){

    var _this = this;

    if (validationType == 'user-group'){

        var group = options[0];
        var user = options[1];

        if (!group._meta)
            return callback(new Error('validation error: group does not exist or has not been saved'));

        if (!user._meta)
            return callback(new Error('validation error: user does not exist or has not been saved'));

        return _this.dataService.get(group._meta.path, {}, function(e, result){

            if (e) return callback(e);

            if (!result)
                return callback(new Error('validation error: group does not exist: ' + group._meta.path));

            return _this.dataService.get(user._meta.path, {}, function(e, result){

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

    var checkOverwrite = function(path, name){

        if (!name)
            name = obj.name;

        if (options && options.overwrite === false){
            _this.dataService.get(path, {}, function(e, result){

                if (e) return callback(e);

                if (result)
                    return callback(new Error('validation failure: ' + validationType + ' by the name ' + name + ' already exists'));

                callback();

            });
        }else
            return callback();
    }

    if (validationType == 'user'){

        if (!obj._meta && !obj.password)
            return callback(new Error('validation failure: no password specified for a new user'));

        if (!obj.username)
            return callback(new Error('validation failure: no username specified'));

        return checkOverwrite('/_SYSTEM/_SECURITY/_USER/' + obj.username, obj.username);
    }

    if (validationType == 'group'){
        if (options.parent){
            if (!options.parent._meta.path)
                return callback(new Error('validation error: parent group path is not in your request, have you included the _meta?'));
            //path, parameters, callback
            return _this.dataService.get(options.parent._meta.path, {}, function(e, result){

                if (e) return callback(e);

                if (!result)
                    return callback(new Error('validation error: parent group does not exist: ' + options.parent._meta.path));

                checkOverwrite(options.parent._meta.path + '/' + obj.name);

            });
        }

        return checkOverwrite('/_SYSTEM/_SECURITY/_GROUP/' + obj.name);
    }

    if (validationType == 'permission'){

        var permission = options[0];
        var permissionGroup = options[1];

        if (!permissionGroup)
            return callback(new Error('validation error: you need a group to add a permission to'));

        if (!permissionGroup._meta.path)
            return callback(new Error('validation error: permission group path is not in your request, have you included the _meta?'));
        //path, parameters, callback

        return _this.dataService.get(permissionGroup._meta.path, {}, function(e, result){

            if (e) return callback(e);

            if (!result)
                return callback(new Error('validation error: permission group does not exist: ' + permissionGroup._meta.path));

            callback();

        });

        return callback();
    }

    throw new Error('Unknown validation type: ' + validationType);
}

SecurityService.prototype.login = function(credentials, callback) {

    var _this = this;
    if (credentials.username && credentials.password) {

        return _this.getUser(credentials.username, {includePassword:true}, function(e, user){

            if (e) return callback(e);
            if (user == null) return callback(_this.AccessDeniedError('Invalid credentials'));

            _this.verifyHash(credentials.password, _this.__passwordCache.get(user.username), function(e, match) {

                if (e) return callback(e);

                if (!match) return callback(_this.AccessDeniedError('Invalid credentials'));

                delete user['password'];
                return _this.generateSession(user, callback);

            });
        });
    }
    else
        callback(_this.AccessDeniedError('Invalid credentials'));
   
}

SecurityService.prototype.serializeAll = function(objectType, objArray, options){

    var _this = this;

    if (!objArray)
        return [];

    return objArray

    .map(function(obj){
        return _this.serialize(objectType, obj, options);
    })

}

SecurityService.prototype.serialize = function(objectType, obj, options){

    var returnObj = this.happn.utils.clone(obj.data);
    returnObj._meta = obj._meta;

    return returnObj;
}

SecurityService.prototype.__prepareUser = function(user, options, callback){

    var clonedUser =   this.happn.utils.clone(user);//we are passing the back to who knows where and it lives here in the cache...

    if (user.password){

        return this.generateHash(user.password, function(e, hash){

            if (e) return callback(e);

            clonedUser.password = hash;
            callback(null, clonedUser);

        });

    }else{
        callback(null, clonedUser);
    }

}

SecurityService.prototype.__upsertUser = function(user, options, callback){

    var _this = this;

    if (typeof options == 'function') {
        callback = options;
    }

    _this.__prepareUser(user, options, function(e, prepared){

        if (e) return callback(e);

        var userPath =  '/_SYSTEM/_SECURITY/_USER/' + prepared.username;
       
        _this.dataService.upsert(userPath, prepared, {merge:true}, function(e, result){

            if (e) return callback(e);

            if (prepared.password)
                _this.__passwordCache.del(user.username);
            
            var upserted = _this.serialize('user', result, options);

            _this.__userCache.del(user.username);
            _this.dataChanged('upsert-user', upserted);

            callback(null, upserted);

        });

    });
}

SecurityService.prototype.upsertUser = function(user, options, callback) {

    var _this = this;

    if (typeof options == 'function') {
        callback = options;
    }

    try {
        _this.__validate('user', options, user, function(e) {
            if (e) return callback(e);

            _this.__upsertUser(user, options, callback);
        });
    } catch (e) {
        callback(e);
    }
}

SecurityService.prototype.deleteUser = function(user, options, callback) {
    if (typeof options == 'function') {
        callback = options;
    }
    var _this = this;
    var userPath =  '/_SYSTEM/_SECURITY/_USER/' + user.username;
    var userTree =  '/_SYSTEM/_SECURITY/_USER/' + user.username + '/*';

    _this.dataService.remove(userPath, {}, function(e, result1){

        if (e) return callback(e);

        _this.dataService.remove(userTree, {}, function(e, result2){
        
            if (e) return callback(e);

            var deleted = {obj: result1, tree: result2};

            _this.__userCache.del(user.username);
            _this.__passwordCache.del(user.username);

            _this.dataChanged('delete-user', deleted);
          
            return callback(null, deleted);

        });
    });

}

SecurityService.prototype.__upsertGroup = function(group, options, callback){

    var _this = this;
    var groupPath;

    if (options.parent)//we have checked in __validate
        groupPath = options.parent._meta.path + '/' + group.name;
    else
        groupPath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;
    
    _this.dataService.upsert(groupPath, group, {merge:true}, function(e, result){
        if (e) return callback(e);

        var upserted = _this.serialize('group', result, options);

        _this.__groupCache.del(group.name);
        _this.dataChanged('upsert-group', upserted);

        callback(null, upserted);

    });

};

SecurityService.prototype.upsertGroup = function(group, options, callback){

    var _this = this;

    if (typeof options == 'function') {
        callback = options;
    }

    try{
        _this.__validate('group', options, group, function(e){
            if (e) return callback(e);
            _this.__upsertGroup(group, options, callback);
        });
    }catch(e){
        callback(e);
    }
}

SecurityService.prototype.deleteGroup = function(group, options, callback){
    var _this = this;

    if (typeof options == 'function')
        callback = options;

    ///_SYSTEM/_SECURITY/_GROUP/GROUP TO REMOVE1444994674567_N1X9paYll/*
    var deletePath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;
    //get = function(path, parameters, callback){ 
    try{
        _this.dataService.remove(deletePath, {}, function(e, groupDeleteResults){
            if (e) return callback(e);

            deletePath = '/_SYSTEM/_SECURITY/_USER/*/_USER_GROUP/' + group.name + '/*';

            _this.dataService.remove(deletePath, {}, function(e, userGroupDeleteResults){
                if (e) return callback(e);

                var deleted = {group: groupDeleteResults, links: userGroupDeleteResults};
                _this.__groupCache.del(group.name);
                _this.dataChanged('delete-group', deleted);
              
                return callback(null, deleted);
            });

        });
    }catch(e){
        callback(e);
    }
}

SecurityService.prototype.listGroups = function(groupName, options, callback){
    var _this = this;

    if (typeof options == 'function')
        callback = options;

    if (typeof groupName == 'function'){
         callback = groupName;
         groupName = '*';
    }
    
    if (groupName[groupName.length - 1] != '*')
        groupName += '*';

    var searchPath = '/_SYSTEM/_SECURITY/_GROUP/' + groupName
    
    try{
        _this.dataService.get(searchPath, {sort:"_id"}, function(e, results){
            if (e) return callback(e);

            callback(null, _this.serializeAll('group', results, options));
        });
    }catch(e){
        callback(e);
    }
}

SecurityService.prototype.getGroup = function(groupName, options, callback){
    var _this = this;

    if (typeof options == 'function')
        callback = options;

    groupName = groupName.replace(/[*]/g, '');
    var searchPath = '/_SYSTEM/_SECURITY/_GROUP/' + groupName;
   
    try{

        var cachedGroup = _this.__groupCache.get(groupName);

        if (cachedGroup) return callback(null, _this.happn.utils.clone(cachedGroup));//we are passing the back to who knows 
                                                                                     //where and it lives here in the cache, not cloing results in it being modified here
        _this.dataService.get(searchPath, {sort:"_id"}, function(e, result){
            if (e) return callback(e);

            if (result){

                var group = _this.serialize('group', result, options);
                _this.__groupCache.set(groupName, _this.happn.utils.clone(group));//we are passing the back to who knows 
                                                                            //where and it lives here in the cache, not cloing results in it being modified here
                callback(null, _this.happn.utils.clone(group));
            }else
                callback(null, null);
        });

    }catch(e){
        callback(e);
    }
}

SecurityService.prototype.getUser = function(userName, options, callback){
    var _this = this;

    if (typeof options == 'function'){
        callback = options;
        options = {};
    }

    options.includePassword = true;
        
    userName = userName.replace(/[*]/g, '');
    var userPath = '/_SYSTEM/_SECURITY/_USER/' + userName;
    var searchPath = userPath + '*';

    try{

        var cachedUser = _this.__userCache.get(userName);

        if (cachedUser) return callback(null, cachedUser);

        _this.dataService.get(searchPath, {sort:"_id"}, function(e, results){
            if (e) return callback(e);

            if (results.length > 0){

                var returnUser = _this.serialize('user', results[0], options);
                returnUser.groups = {};

                results.every(function(userItem, userItemIndex){
                    if (userItemIndex > 0){
                        var userGroupItem = results[userItemIndex];

                        if (userGroupItem._meta.path.indexOf(userPath + '/') == 0)
                            returnUser.groups[userGroupItem._meta.path.replace(userPath + '/_USER_GROUP/', '')] = userGroupItem;
                    }
                    return true;
                });

                _this.__userCache.set(userName, returnUser);
                _this.__passwordCache.set(userName, returnUser.password);

                callback(null, returnUser);
            }
            else
                callback(null, null);

        });

    }catch(e){
        callback(e);
    }
}

SecurityService.prototype.listUsers = function(userName, options, callback){
    var _this = this;

    if (typeof options == 'function')
        callback = options;

    if (typeof userName == 'function'){
         callback = groupName;
         userName = '*';
    }
    
    if (userName[userName.length - 1] != '*')
        userName += '*';

    var searchPath = '/_SYSTEM/_SECURITY/_USER/' + userName
    //get = function(path, parameters, callback){ 
    try{
        _this.dataService.get(searchPath, {criteria: {$not: { "_id":{$regex: new RegExp(".*_USER_GROUP.*") }}}}, function(e, results){
            if (e) return callback(e);

            callback(null, _this.serializeAll('user', results, options));
        });
    }catch(e){
        callback(e);
    }
}

SecurityService.prototype.linkGroup = function(group, user, options, callback){

    var _this = this;

    if (typeof options == 'function') {
        callback = options;
        options = {};
    }

    try{
        _this.__validate('user-group', [group, user], options, function(e){

            if (e) return callback(e);

            var groupLinkPath = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name;

            _this.dataService.upsert(groupLinkPath, options, {merge:true}, function(e, result){
                if (e) return callback(e);

                var upserted = _this.serialize('user-group', result, options);
                _this.dataChanged('link-group', upserted);

                callback(null, upserted);

            });
        });
    }catch(e){
        callback(e);
    }
}

SecurityService.prototype.unlinkGroup = function(group, user, options, callback){

    var _this = this;

    if (typeof options == 'function') {
        callback = options;
        options = {};
    }

    try{
         _this.__validate('user-group', [group, user], null, function(e){
            if (e) return callback(e);

            var groupLinkPath = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name;

            _this.dataService.remove(groupLinkPath, {}, function(e, result){
                if (e) return callback(e);

                _this.dataChanged('unlink-group', groupLinkPath);
                callback(null, result);
            });
        });
    }catch(e){
        callback(e);
    }
}

SecurityService.prototype.authorize = function(session, path, action, callback){
    this.__checkpoint._authorize(session, path, action, callback);
}

SecurityService.prototype.safe = function(){
    var _this = this;

    return {
        login:_this.login.bind(_this),
        encryptAsymmetrical:_this.encryptAsymmetrical.bind(_this),
        decryptAsymmetrical:_this.decryptAsymmetrical.bind(_this),
        generateSession:_this.generateSession.bind(_this),
        checkToken:_this.checkToken.bind(_this),
        generateKeyPair:_this.generateKeyPair.bind(_this),
        verifyHash:_this.verifyHash.bind(_this),
        generateHash:_this.generateHash.bind(_this),
        serializeKeyPair:_this.serializeKeyPair.bind(_this),
        deserializeKeyPair:_this.deserializeKeyPair.bind(_this),
        authorize:_this.authorize.bind(_this),
        AccessDeniedError:_this.AccessDeniedError.bind(_this),
        onDataChanged:_this.onDataChanged.bind(_this),
        offDataChanged:_this.offDataChanged.bind(_this),
        generatePermissionSetKey:_this.generatePermissionSetKey.bind(_this),
        generateEmptySession:_this.generateEmptySession.bind(_this)
    }
}





