var jwt = require('jwt-simple');
var moment = require('moment');
// var crypto = require('crypto');
var shortid = require('shortid');

module.exports = AuthService;

function AuthService() {

}

AuthService.prototype.initialize = function(config, done){
    try{

        if (!config.tokenttl)
            config.tokenttl = 0;

        if (!config.authTokenSecret)
           return done('Missing authTokenSecret parameter');

        if (!config.systemSecret)
            return done('Missing systemSecret parameter');

        this.config = config;
        done();
        
    }catch(e){
        done(e);
    }
}

AuthService.prototype.checkToken = function(token){
    try{
        this.decodeToken(token);
        return true;
    }catch(e){
        return false;
    }
}

AuthService.prototype.decodeToken = function(token){
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

AuthService.prototype.newSession = function(credentials, data){
    if (credentials){
        return this.login(credentials);
    }else{
        return this.generateSession(data);
    }
}

AuthService.prototype.generateSession = function(session_data){

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

AuthService.prototype.login = function(credentials){
        
    //login attempt is happening

    if (credentials.secret == this.config.systemSecret){
        return this.generateSession(credentials.session_data);
    }else{
        throw new Error('Invalid credentials');
    }
       
}