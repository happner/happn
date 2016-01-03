describe('b7_security_https', function() {

  var happn = require('../lib/index');
  var serviceInstance;
  var searchClient;
  var expect = require('expect.js');
  var test_id = Date.now() + '_' + require('shortid').generate();
  var async = require('async');

  var getService = function(config, callback){
   happn.service.create(config,
      callback
    );
  }

  it('starts an https server, with a configured cert and key', function(done) {

  });

  it('starts an https server, with a configured cert and key file path pointing to existing files', function(done) {

  });

  it('starts an https server, with a configured cert and key file path pointing to non-existing files', function(done) {

  });

  it('it fails to start an https, due to bad values in the key cert', function(done) {

  });

  it('it fails to start an https server, missing key', function(done) {

  });

  it('it fails to start an https server, missing cert', function(done) {

  });

  it('it fails to start an https server, missing key file path', function(done) {

  });

  
});
