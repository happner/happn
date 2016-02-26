var happn = require('../../../lib')

module.exports = {
  description:"eventemitter embedded functional tests",
  serviceConfig:{
	  mode: 'embedded',
	  services: {
	    auth: {
	      path: './services/auth/service.js',
	      config: {
	        authTokenSecret: 'a256a2fd43bf441483c5177fc85fd9d3'
	      }
	    },
	    data: {
	      path: './services/data_embedded/service.js',
	      config: {}
	    },
	    pubsub: {
	      path: './services/pubsub/service.js'
	    }
	  },
	  utils: {
	    log_level: 'info|error|warning',
	    log_component: 'prepare'
	  }
	},
  publisherConfig:function(happnInstance){
    return null;
  },
  listenerConfig:function(happnInstance){
  	return null;
  }
}