var https = require('https');
var fs = require('fs');
var path = require('path');

module.exports = {
	checkFileExists:function(path){
		try{
			var fileStats = fs.statSync(path);

			if (fileStats.isFile())
				return true;
			else
				return false;

		}catch(e){
			return false;
		}
	},
	createCertificate:function(keyPath, certPath, callback){
		
		var pem = require('pem');

		pem.createCertificate({selfSigned:true}, function(err, keys){

			if (err) return callback(err);

			fs.writeFileSync(keyPath, keys.serviceKey);
			fs.writeFileSync(certPath, keys.certificate);

			callback(null, {cert:keys.certificate, key:keys.serviceKey})

		});
	},
	createServer:function(config, app, log, callback){

		if (!config)
			config = {};

		if (!config.mode) config.mode = 'http';

		if (config.mode == 'http'){
			return callback(null, require('http').createServer(app));
		}
		else if (config.mode == 'https'){
			var options = {};
			
			if (config.cert && !config.key)
				throw new Error('key file missing for cert');

			if (config.key && !config.cert)
				throw new Error('cert file missing key');

			if (config.cert){

				options.key = config.key;
				options.cert = config.cert;

			}else{

				if (!config.certPath){

					var userHome = require('user-home');

					config.certPath = userHome + require('path').sep + '.happn-https-cert';
					config.keyPath = userHome + require('path').sep + '.happn-https-key';

				}
				
				var certFileExists = this.checkFileExists(config.certPath);
				var keyFileExists = this.checkFileExists(config.keyPath);

				if (certFileExists){

					options.cert = fs.readFileSync(config.certPath);

					if (keyFileExists){
						options.key = fs.readFileSync(config.keyPath);
					}
					else throw new Error('unable to find key file ' + config.keyPath);
					

				}else{

					if (keyFileExists) throw new Error('cert file for key file ' + config.keyPath + ' is missing');

					log.warn('cert file ' + config.certPath + ' is missing, trying to generate...');

					return this.createCertificate(config.keyPath, config.certPath, function(e, keys){
						options = keys;
						callback(null, https.createServer(options));
					});

				}

			}

			return callback(null, https.createServer(options));


		}
		else throw new Error('unknown transport mode: ' + config.mode + ' can only be http or https');
		
	}
}