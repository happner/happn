var happn = require('../../../lib');
var happn_client = happn.client;

module.exports = {
  description:"eventemitter embedded functional tests with encrypted payloads",
  serviceConfig:{
	  secure:true,
	  encryptPayloads:true
  },
  publisherClient:function(happnInstance, callback){

    var config =  {
		plugin: happn.client_plugins.intra_process,
		context: happnInstance,
		config:{
			username:'_ADMIN',
			password:'happn'
		},
		encryptPayloads
	}

	happn_client.create(config, callback);

  },
  listenerClient:function(happnInstance, callback){

  	var config =  {
		plugin: happn.client_plugins.intra_process,
		context: happnInstance,
		config:{
			username:'_ADMIN',
			password:'happn'
		}
	}

	happn_client.create(config, callback);

  }
}