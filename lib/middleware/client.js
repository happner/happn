function ClientMiddleware(){

}

ClientMiddleware.prototype.initialize = function (config, callback) {
  this.happn.log('Client middleware loaded');
};

ClientMiddleware.prototype.cached = null;

ClientMiddleware.prototype.process = function (req, res, next) {
  var _this = this;

  var fs = require('fs');

  if (req.url != '/browser_client') return next();

  res.setHeader('Content-Type', 'application/javascript');

  if (_this.cached) return res.end(_this.cached);

  var path = require('path');
  var protocol = require('../../package.json').protocol;

  fs.readFile(path.resolve(__dirname, '../client/base.js'), function (e, buf) {

    var clientScript = buf.toString().replace('{{protocol}}', protocol);//set the protocol here

    _this.cached = '\/\/happn client v' + require('../../package.json').version + '\r\n' +
      '\/\/protocol v' + protocol + '\r\n' +
      clientScript;

    res.end(_this.cached);
  });
};

module.exports = new ClientMiddleware();
