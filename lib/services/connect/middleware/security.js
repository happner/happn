var url = require('url');

function SecurityMiddleware(){

}

SecurityMiddleware.prototype.__tryDecodeToken = function (token) {
  try {
    var session = this.happn.services.security.decodeToken(token);
    session.type = 0;
    return session;
  } catch (e) {
    return null;
  }
};

SecurityMiddleware.prototype.__respondError = function (res, message) {
  res.writeHead(403, 'unauthorized access', {'content-type': 'text/plain'});
  return res.end(message);
};

SecurityMiddleware.prototype.initialize = function (config) {

  if (!config) config = {};
  this.config = config;

  if (!this.config.exclusions) this.config.exclusions = [];

};

SecurityMiddleware.prototype.excluded = function (req, next) {

  if (this.config.exclusions.length > 0) {

    var exclusions = this.config.exclusions;

    for (var patternIndex in exclusions) {
      var pattern = exclusions[patternIndex];
      if (pattern == '/') {
        if (req.url == pattern) {
          next();
          return true;
        }
        continue; // don't allow '/' exclusion into wildcardMatch (it always matches)
      }
      if (this.happn.services.utils.wildcardMatch(pattern, req.url)) {
        next();
        return true;
      }
    }
    return false;

  } else {
    return false;
  }
};

SecurityMiddleware.prototype.__respond = function(message, data, error, res, code){

  var responseString = '{"message":"' + message + '", "data":{{DATA}}, "error":{{ERROR}}}';

  var header = {
    'Content-Type': 'application/json'
  };

  if (error) {

    if (!code) code = 500;
    responseString = responseString.replace("{{ERROR}}", this.happn.services.utils.stringifyError(error));

  } else {

    if (!code) code = 200;
    responseString = responseString.replace("{{ERROR}}", "null");

  }

  res.writeHead(code, header);

  if (data) responseString = responseString.replace("{{DATA}}", JSON.stringify(data));
  else responseString = responseString.replace("{{DATA}}",  "null");

  res.end(responseString);
};

SecurityMiddleware.prototype.process = function (req, res, next) {
  var _this = this;

  if (_this.happn.config.secure) {

    try {

      if (_this.excluded(req, next)) return;

      if (req.url.substring(0, 1) != '/') req.url = '/' + req.url;

      var parsedUrl = require('url').parse(req.url, true);
      var query = parsedUrl.query;
      var path = parsedUrl.pathname;

      if (path == '/auth/request-nonce'){

        var params = {};

        params.publicKey = _this.happn.services.utils.getFirstMatchingProperty(['publicKey','public_key','public','key','public-key'], query);

        return _this.happn.services.security.createAuthenticationNonce(params, function(e, nonce){

          if (e) return next(e);

          //message, data, error, res, code
          _this.__respond('nonce generated', nonce, null, res);

        });
      }

      if (path == '/auth/login'){

        var params = {};

        params.username = _this.happn.services.utils.getFirstMatchingProperty(['user','username','u'], query);
        params.password = _this.happn.services.utils.getFirstMatchingProperty(['password','pwd','pass','p'], query);
        params.publicKey = _this.happn.services.utils.getFirstMatchingProperty(['publicKey','public_key','public','key','public-key','pk'], query);
        params.digest = _this.happn.services.utils.getFirstMatchingProperty(['digest'], query);

        return _this.happn.services.security.login({request:{data:params}}, function (e, session) {

          if (e) return  _this.__respond('login failed', null, e, res, 403);
          _this.__respond('login successful', session.token, null, res);

        });
      }

      var token = req.cookies.get(this.config.cookieName || 'happn_token');

      if (!token) token = query.happn_token;

      if (!token) return _this.__respondError(res, 'happn_token cookie missing in request');

      var session = _this.__tryDecodeToken(token);

      if (!session) return _this.__respondError(res, 'invalid token format or null token');

      var url = require('url');

      var path = '/@HTTP' + url.parse(req.url).pathname;

      session.type = 0;//stateless session

      _this.happn.services.security.authorize(session, path, req.method.toLowerCase(), function (e, authorized) {

        if (e) return next(e);

        if (!authorized) return _this.__respondError(res, 'unauthorized access to path ' + path);

        next();

      });

    } catch (e) {
      next(e);
    }
  }
  else
    next();
};

module.exports = new SecurityMiddleware();
