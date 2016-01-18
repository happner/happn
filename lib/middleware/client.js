/*
var browserify = require('browserify'),
byline = require('byline');
*/

var fs = require('fs');

module.exports = {
	cached:null,
	process:function(req, res, next){
		var _this = this;

		if (req.url != '/browser_client')
			return next();

		res.setHeader("Content-Type", "application/javascript");

		if (_this.cached)
			return res.end(_this.cached);

		var path = require('path');

		fs.readFile(path.resolve(__dirname, '../client/base.js'), function(e, buf) {
			_this.cached = buf.toString();
			res.end(_this.cached);
		});
	}
}