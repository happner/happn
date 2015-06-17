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
        decodeToken:function(token){
            
            var _this = this;
            
            try{

                if (!token)
                    throw 'No authentication token was found in the request';
            
                var decoded = _this.internals.jwt.decode(token, _this.config.authTokenSecret);
                
                 ////////////console.log(decoded);

                //we allow for a minute, in case the backend code takes a while to sync
                if (decoded.expires > 0 && decoded.expires + 60 < _this.internals.moment.unix())
                    throw 'Token has expired';

                
                return decoded;

            }catch(e){
                throw 'Authentication failed: ' + e.toString();
            }
        },
        generateToken:function(session_data){

            var _this = this;

            if (!session_data)
                session_data = {};

            var session = {data:session_data};
            session.id = _this.internals.shortid.generate();

            var expiryTime = 0;

            if (_this.config.tokenttl > 0)
                expiryTime = _this.internals.moment.unix() + (_this.config.tokenttl * 60);
           
            session.expires = expiryTime;
            session.ttl = _this.config.tokenttl;

            return _this.internals.jwt.encode(session, _this.config.authTokenSecret);
            
        },
        login:function(params){
            //login attempt is happening
            
          var _this = this;

          if (params.secret == _this.config.systemSecret){
                return _this.generateToken(params.session_data);
          }else{
                throw 'Invalid credentials';
          }
           
        }
}