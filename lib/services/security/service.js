var jwt = require('jwt-simple');
var moment = require('moment');
var crypto = require('crypto');
var shortid = require('shortid');
var bitcore = require('bitcore');
var ECIES = require('bitcore-ecies');

module.exports = SecurityService;

function SecurityService() {

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
        done();
        
    }catch(e){
        done(e);
    }
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
    
        var decoded = jwt.decode(token, this.config.authTokenSecret);
        
        //we allow for a minute, in case the backend code takes a while to sync
        if (decoded.expires > 0 && decoded.expires + 60 < moment().unix())
            throw new Error('Token has expired');

        
        return decoded;

    }catch(e){
        throw new Error('Authentication failed: ' + e.toString());
    }
}

SecurityService.prototype.newSession = function(credentials, data){
    if (credentials){
        return this.login(credentials);
    }else{
        return this.generateSession(data);
    }
}

SecurityService.prototype.generateSession = function(session_data){

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
    session.token = jwt.encode(session, this.config.authTokenSecret);

    //console.log('generated session', session);

    return session;
    
}

SecurityService.prototype.validate = function(validationType, options, obj, callback){

    var _this = this;

    if (obj.name && (obj.name.indexOf('_GROUP') > -1 || obj.name.indexOf('_PERMISSION') > -1 || obj.name.indexOf('_USER_GROUP') > -1))
        return callback(new Error('validation error: ' + validationType + ' names cannot contain the special _GROUP or _PERMISSION segment'));

    if (obj.name && (obj.name.indexOf('/') > -1))
        return callback(new Error('validation error: ' + validationType + ' names cannot contain forward slashes'));

    if (validationType == 'user'){
        
        return callback(null);
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

                callback();

            });
        }

        return callback();
    }

    if (validationType == 'permission'){

        if (obj.indexOf('_SYSTEM') == 0 || obj.indexOf('/_SYSTEM') == 0)
            return callback(new Error('validation error: nobody except HAPPN has or can be granted access to the /SYSTEM leaf'));
       
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

SecurityService.prototype.login = function(credentials){
        
    //login attempt is happening

    if (credentials.secret == this.config.systemSecret){
        return this.generateSession(credentials.session_data);
    }else{
        throw new Error('Invalid credentials');
    }
       
}

//upsert = function(path, data, options, callback){

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
    }

    if (objectType == 'permission'){
        
    }

    if (objectType == 'user-group'){
        
    }

    return returnObj;
}

SecurityService.prototype.upsertGroup = function(group, options, callback){

    var _this = this;

    if (typeof options == 'function')
        callback = options;

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

SecurityService.prototype.removeGroup = function(){

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

        var permissionPath = group._meta.path + '/_PERMISSION' + path;

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







