function ClientMiddleware(){

}

ClientMiddleware.prototype.initialize = function (config, callback) {
  this.happn.log('Client middleware loaded');
};

ClientMiddleware.prototype.cached = null;

ClientMiddleware.prototype.process = function (req, res, next) {

  try{

    var _this = this;

    var fs = require('fs');

    if (req.url != '/browser_client') return next();

    res.setHeader('Content-Type', 'application/javascript');

    if (_this.cached) return res.end(_this.cached);

    var package = require('../../../../package.json');

    var path = require('path');
    var protocol = package.protocol;

    fs.readFile(path.resolve(__dirname, '../../../client.js'), function (e, buf) {

      var clientScript = buf.toString().replace('{{protocol}}', protocol);//set the protocol here

      _this.cached = '\/\/happn client v' + package.version + '\r\n' +
        '\/\/protocol v' + protocol + '\r\n' +
        clientScript;

      res.end(_this.cached);
    });

  }catch(e){
    next(e);
  }
};

module.exports = new ClientMiddleware();
