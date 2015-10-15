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

SecurityService.prototype.login = function(credentials){
        
    //login attempt is happening

    if (credentials.secret == this.config.systemSecret){
        return this.generateSession(credentials.session_data);
    }else{
        throw new Error('Invalid credentials');
    }
       
}

SecurityService.prototype.upsertUser = function(user, opts, callback){
    
}