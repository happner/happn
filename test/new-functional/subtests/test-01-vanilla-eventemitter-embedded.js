var happn = require('../../../lib')
var happn_client = happn.client;

module.exports = {
  description:"eventemitter embedded functional tests",
  serviceConfig:{},
  publisherClient:function(happnInstance, callback){

    var config =  {
		plugin: happn.client_plugins.intra_process,
		context: happnInstance
	}

	happn_client.create(config, callback);
  },
  listenerClient:function(happnInstance, callback){

  	var config =  {
		plugin: happn.client_plugins.intra_process,
		context: happnInstance
	}

	happn_client.create(config, callback);
  }
}