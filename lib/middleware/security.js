module.exports = {
  __tryDecodeToken: function (token) {
    try {
      return this.happn.services.security.decodeToken(token);
    } catch (e) {
      return null;
    }
  },
  __respondError: function (res, message) {
    res.writeHead(403, 'unauthorized access', {'content-type': 'text/plain'});
    return res.end(message);
  },

  initialize: function (config) {

    if (config) this.config = config;
    else this.config = {};

    if (!this.config.exclusions)
      this.config.exclusions = [];

  },

  excluded: function (req, next) {

    if (this.config.exclusions && this.config.exclusions.length > 0) {

      for (var patternIndex in this.config.exclusions) {
        var pattern = this.config.exclusions[patternIndex];
        if (pattern == '/') {
          if (req.url == pattern) {
            next();
            return true;
          }
          continue; // don't allow '/' exclusion into wildcardMatch (it always matches)
        }
        if (this.happn.utils.wildcardMatch(pattern, req.url)) {
          next();
          return true;
        }

      }
      return false;

    } else {
      return false;
    }
  },

  process: function (req, res, next) {
    var _this = this;

    if (_this.happn.config.secure) {

      try {
        if (!_this.excluded(req, next)) {

          var token = req.cookies.get(this.config.cookieName || 'happn_token');

          if (!token) {
            var query = require('url').parse(req.url, true).query;
            token = query.happn_token;
          }

          if (!token) {
            return _this.__respondError(res, 'happn_token cookie missing in request');
          }

          var session_token = _this.__tryDecodeToken(token);

          if (!session_token) return _this.__respondError(res, 'invalid token format or null token');

          var session = _this.happn.services.pubsub.getSession(session_token.id);

          if (!session) return _this.__respondError(res, 'session expired');

          if (req.url.substring(0, 1) != '/')
            req.url = '/' + req.url;

          var url = require('url');

          var path = '/@HTTP' + url.parse(req.url).pathname;

          _this.happn.services.security.authorize(session, path, req.method.toLowerCase(), function (e, authorized) {

            if (e) return next(e);

            if (!authorized) return _this.__respondError(res, 'unauthorized access to path ' + path);

            next();

          });

        }

      } catch (e) {
        next(e);
      }

    }
    else
      next();


  }
}
