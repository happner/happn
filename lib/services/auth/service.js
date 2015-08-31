module.exports  = {
        internals:{
            jwt:require('jwt-simple'),
            moment:require('moment')(),
            crypto:require('crypto'),
            shortid:require('shortid'),

        },
        initialize:function(config, done){
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
        },
        checkToken:function(token){
            var _this = this;

            try{
                _this.decodeToken(token);
                return true;
            }catch(e){
                return false;
            }
        },
        decodeToken:function(token){
            
            var _this = this;
            
            try{

                if (!token)
                    throw new Error('No authentication token was found in the request');
            
                var decoded = _this.internals.jwt.decode(token, _this.config.authTokenSecret);
                
                //we allow for a minute, in case the backend code takes a while to sync
                if (decoded.expires > 0 && decoded.expires + 60 < _this.internals.moment.unix())
                    throw new Error('Token has expired');

                
                return decoded;

            }catch(e){
                throw new Error('Authentication failed: ' + e.toString());
            }
        },
        newSession:function(credentials, data){
            var _this = this;
            if (credentials){
                return _this.login(credentials);
            }else{
                return _this.generateSession(data);
            }
        },
        generateSession:function(session_data){

            var _this = this;

            if (!session_data)
                session_data = {};

            var session = {data:session_data};
            session.id = _this.internals.shortid.generate();

            var expiryTime = 0;
            var timestamp = _this.internals.moment.unix();

            if (_this.config.tokenttl > 0)
                expiryTime = timestamp + (_this.config.tokenttl * 60);
           
            session.timestamp = timestamp;
            session.expires = expiryTime;
            session.ttl = _this.config.tokenttl;
            session.token = _this.internals.jwt.encode(session, _this.config.authTokenSecret);

            //console.log('generated session', session);

            return session;
            
        },
        login:function(credentials){
            //login attempt is happening
            
          var _this = this;

          if (credentials.secret == _this.config.systemSecret){
                return _this.generateSession(credentials.session_data);
          }else{
                throw new Error('Invalid credentials');
          }
           
        }
}