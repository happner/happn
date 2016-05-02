

var config1 = {
    name:'standard'
};

var config2 = {
    name:'secure',
    secure:true
};

var config3 = {
    name:'secure-https',
    secure:true,
    mode:'https'
};

var config4 = {
    name:'secure-encrypt-payloads',
    secure:true,
    encryptPayloads:true
};



describe('c8-startuptimes', function() {

    this.timeout(120000);

    require('benchmarket').start();
    var async = require('async');
    var service = require('../').service;

    after(function(callback){
        async.eachSeries(instances, function(instance, instanceCB){
            instance.stop(instanceCB);
        }, callback)
    })

    after(require('benchmarket').store());

    var instances = [];

    var startHappn = function(config, callback){

        service.create(config,
        function(e, instance){
            if (e) return callback(e);
            instances.push(instance);
            callback();
        });
    }

    it('starts up a standard instance', function (done) {
        startHappn(config1, done);
    });

    // it('starts up a secure instance', function (done) {
    //     startHappn(config2, done);
    // });
    //
    // it('starts up a secure https instance', function (done) {
    //     startHappn(config3, done);
    // });
    //
    // it('starts up a secure https instance, encrypting payloads', function (done) {
    //     startHappn(config4, done);
    // });

});

