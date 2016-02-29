var happn = require('../../../lib')
var happn_client = happn.client;

module.exports = {
  description:"websockets embedded functional tests",
  serviceConfig:{},
  publisherClient:function(happnInstance, callback){

    var config =  undefined;
	happn_client.create(config, callback);

  },
  listenerClient:function(happnInstance, callback){

  	var config =  undefined;
	happn_client.create(config, callback);

  }
}