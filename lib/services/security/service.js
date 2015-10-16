var jwt = require('jwt-simple');
var moment = require('moment');
var shortid = require('shortid');
var bitcore = require('bitcore');
var ECIES = require('bitcore-ecies');
var symmetricalCrypto = require('password-hash-and-salt');

module.exports = SecurityService;

function SecurityService() {

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

                 _this.keyPair = _this.deserializeKeyPair(result.data.value);

                 callback();
            });

        }else{
            _this.keyPair = _this.deserializeKeyPair(response.data.value);
        }

        callback();

    });
}

SecurityService.prototype._ensureAdminUser = function(config, callback){
    var _this = this;

    _this.dataService.get('/_SYSTEM/_SECURITY/_USER/_ADMIN*', {}, function(e, response){

        if (e) return callback(e);

        if (response.length == 2) return callback();

        if (!config.adminUser)
            config.adminUser = {
                custom_data:{}
            }

        if (!config.adminGroup)
            config.adminGroup = {
                custom_data:{}
            }


        config.adminUser.username = '_ADMIN';
        config.adminGroup.name = '_ADMIN';

        if (!config.adminUser.password)
            config.adminUser.password = 'happn';

        config.adminGroup.permissions = {'/*':{actions:['*']}};

        _this.dataService.upsert('/_SYSTEM/_SECURITY/_GROUP/_ADMIN', config.adminGroup, {}, function(e, response){

            if (e) return callback(e);

            _this.dataService.upsert('/_SYSTEM/_SECURITY/_USER/_ADMIN', config.adminUser, {}, function(e, response){

                if (e) return callback(e);

                _this.dataService.upsert('/_SYSTEM/_SECURITY/_USER/_ADMIN/_USER_GROUP/_ADMIN', {}, {}, callback);

            });

        });

    });
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

        if (!config.adminSecret)
            config.adminSecret = 'happn';

        this.config = config;
        
        var _this = this;

        _this._ensureKeyPair(config, function(e){

            if (e) return done(e);
            _this._ensureAdminUser(config, done);

        });
        
    }catch(e){
        done(e);
    }
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

SecurityService.prototype.newSession = function(credentials, data, callback) {
    if (credentials){
        return this.login(credentials, callback);
    }else{
        return this.generateSession(data, callback);
    }
}

SecurityService.prototype.generateSession = function(session_data, callback){

    if (!session_data)
        session_data = {};

    var session = {data:session_data};
    session.id = shortid.generate();

    var expiryTime = 0;
    var timestamp = moment().unix();

    if (this.config.tokenttl > 0)
        expiryTime = timestamp + (this.config.tokenttl * 60);
   
    session.timestamp = timestamp;
    session.expires = expiryTime;
    session.ttl = this.config.tokenttl;
    session.token = jwt.encode(session, this.config.sessionTokenSecret);

    //console.log('generated session', session);

    callback(null, session);
    
}

SecurityService.prototype.validateName = function(name, validationType){

    if (name && (name.indexOf('_SYSTEM') > -1 || name.indexOf('_GROUP') > -1 || name.indexOf('_PERMISSION') > -1 || name.indexOf('_USER_GROUP') > -1 || name.indexOf('_ADMIN') > -1))
        throw new Error('validation error: ' + validationType + ' names cannot contain the special _SYSTEM, _GROUP, _PERMISSION, _USER_GROUP, _ADMIN segment');

    if (name && (name.indexOf('/') > -1))
        throw new Error('validation error: ' + validationType + ' names cannot contain forward slashes');

}

SecurityService.prototype.validate = function(validationType, options, obj, callback){

    var _this = this;

    if (obj.name)//users, groups
        _this.validateName(obj.name, validationType);

    var checkOverwrite = function(path){
        if (options && options.overwrite === false){

            console.log('checking overwrite:::', obj);

            _this.dataService.get(path, {}, function(e, result){

                if (e) return callback(e);

                if (result)
                    return callback(new Error('validation failure: ' + validationType + ' by the name ' + obj.name + ' already exists'));

                callback();

            });
        }else
            return callback();
    }

    if (validationType == 'user'){

        if (!obj.password)
            return callback(new Error('validation failure: no password specified'));

        if (!obj.username)
            return callback(new Error('validation failure: no username specified'));



        return checkOverwrite('/_SYSTEM/_SECURITY/_USER/' + obj.name);
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

    if (validationType == 'user-group'){

        return callback();
    }

    throw new Error('Unknown validation type: ' + validationType);
}

SecurityService.prototype.login = function(credentials, callback) {

    var _this = this;

    if (credentials.username && credentials.password) {
        
        var userPath = '/_SYSTEM/_SECURITY/_USER/' + credentials.username;

        _this.dataService.get(userPath, {}, function(e, result) {

            console.log('---------------> login result for find user:', result);

            if (e) return callback(e);
            if (result == null) return callback(new Error('Invalid'));

            

        });

        return;

    }

    // TODO: config needs to specifiy if username/password is required
    //       cannot fall back to secret simply because it's present

    if (credentials.secret == this.config.systemSecret){
        return this.generateSession(credentials.session_data, callback);
    }
    
    callback(new Error('Invalid'));
   
}

//upsert = function(path, data, options, callback) {

SecurityService.prototype.serializeAll = function(objectType, objArray, options){

    var _this = this;

    if (!objArray)
        return [];

    return objArray.map(function(obj){
        return _this.serialize(objectType, obj, options)
    });
}

SecurityService.prototype.serialize = function(objectType, obj, options){

    var returnObj = obj.data;
    returnObj._meta = obj._meta;

    if (objectType == 'group'){
       if (options.excludeRelated && returnObj._meta.path.indexOf('_PERMISSION'))//the case of this being called by serializeAll, and we have permissions in the array
            return null;
    }

    if (objectType == 'user'){

        if (options.excludeRelated && returnObj._meta.path.indexOf('_USER_GROUP'))//the case of this being called by serializeAll, and we have user groups in the array
            return null;

        delete returnObj['password'];

    }

    if (objectType == 'permission'){
        
    }

    if (objectType == 'user-group'){
        
    }

    return returnObj;
}

SecurityService.prototype.upsertUser = function(user, options, callback) {

    // return callback(new Error('User already exists'));
    
    var _this = this;

    if (typeof options == 'function') {
        callback = options;
        // no options means no {overwite: false}
        // which means this is upsert not create
        // which means it does a merge
        options = {
            merge: true
        };
    }

    try {
        _this.validate('user', options, user, function(e) {
            if (e) return callback(e);

            _this.generateHash(user.password, function(e, hash){

                if (e) return callback(e);

                var userPath =  '/_SYSTEM/_SECURITY/_USER/' + user.username;

                user.password = hash;

                _this.dataService.upsert(userPath, user, {}, function(e, result){
                    if (e) return callback(e);
                    callback(null, _this.serialize('user', result, {}));
                });
            });
        });
    } catch (e) {
        callback(e);
    }
}

SecurityService.prototype.deleteUser = function(user, options, callback) {
    if (typeof options == 'function') {
        callback = options;
        options = {};
    }
    var _this = this;
    var userPath =  '/_SYSTEM/_SECURITY/_USER/' + user.username;
    var userTree =  '/_SYSTEM/_SECURITY/_USER/' + user.username + '/*';

    _this.dataService.remove(userPath, {}, function(e, result1){

        if (e) return callback(e);

        _this.dataService.remove(userTree, {}, function(e, result2){
        
            if (e) return callback(e);

            return callback(null, {obj: result1, tree: result2});

        });
    });

}

SecurityService.prototype.upsertGroup = function(group, options, callback){

    var _this = this;

    if (typeof options == 'function') {
        callback = options;
        options = {};
    }

    try{
        _this.validate('group', options, group, function(e){
            if (e) return callback(e);

            var groupPath;

            if (options.parent)//we have checked in validate
                groupPath = options.parent._meta.path + '/' + group.name;
            else
                groupPath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;
            
            _this.dataService.upsert(groupPath, group, {merge:true}, function(e, result){
                if (e) return callback(e);
                callback(null, _this.serialize('group', result, options));
            });
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
    var deletePath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name + '*';
    //get = function(path, parameters, callback){ 
    try{
        _this.dataService.remove(deletePath, {}, function(e, groupDeleteResults){
            if (e) return callback(e);

            deletePath = '/_SYSTEM/_SECURITY/_USER/*/_USER_GROUP/' + group.name + '/*';

            _this.dataService.remove(deletePath, {}, function(e, userGroupDeleteResults){
                if (e) return callback(e);

                return callback(null, {obj:groupDeleteResults, tree:userGroupDeleteResults});
            });

        });
    }catch(e){
        callback(e);
    }
}

//testServices.security.listGroups('TEST*', function(e, result){
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
    //get = function(path, parameters, callback){ 
    try{
        _this.dataService.get(searchPath, {}, function(e, results){
            if (e) return callback(e);

            callback(null, _this.serializeAll('group', results, options));
        });
    }catch(e){
        callback(e);
    }
}

/*

//addPermission('/b1_eventemitter_security_groups/' + test_id + '/permission_set', {action:['set']}, addedGroup, function(e, result){
SecurityService.prototype.addPermission = function(path, permission, group, callback){
    var _this = this;

    if (typeof group == 'function'){
        callback = group;
        group = permission;
        permission = {action:'*'};
    }

    _this.validate('permission', [permission,group], path, function(e){

        if (e) return callback(e);

        if (path.indexOf('/') != 0)
            path = '/' + path;

        if (!group.permissions)
            group.permissions = {};
        
        group.permissions[path] = permission;

        _this.dataService.upsert(permissionPath, permission, {merge:true}, function(e, result){
            if (e) return callback(e);
            callback(null, _this.serialize('permission', result));
        });

    });
}

SecurityService.prototype.listPermissions = function(group, options, callback){
    var _this = this;

    if (typeof options == 'function'){
        callback = options;
    }

    var permissionPath = group._meta.path + '/_PERMISSION*';

    _this.dataService.get(permissionPath, {}, function(e, results){
        if (e) return callback(e);
        callback(null, _this.serializeAll('permission', results));
    });
}

*/







