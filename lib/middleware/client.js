/*
var browserify = require('browserify'),
byline = require('byline');
*/

var fs = require('fs'),
byline = require('byline');

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

		// var stream = byline(fs.createReadStream(path.resolve(__dirname, '../client/base.js'), { encoding: 'utf8' }));
		// var js = '';

		// stream.on('readable', function() {
		// 	var line;

		// 	while (null !== (line = stream.read())) {

		// 		if (line.indexOf('//BEGIN SERVER-SIDE ADAPTER - DO NOT REMOVE THIS COMMENT') > -1){
		// 			line = '/*';
		// 		}
		// 		else if (line.indexOf('//END SERVER-SIDE ADAPTER') > -1){
		// 			line = '*/';
		// 		}
		// 		else if (line.indexOf('/*BEGIN CLIENT-SIDE ADAPTER - DO NOT REMOVE THIS COMMENT') > -1){
		// 			line = '';
		// 		}
		// 		else if (line.indexOf('*///END CLIENT-SIDE ADAPTER') > -1){
		// 			line = '';
		// 		}

		// 		js += line + '\n';
		// 	}
		// });	

		// stream.on('end', function() {
		//   	_this.cached = js;
		// 	res.end(_this.cached);
		// });
	}
}