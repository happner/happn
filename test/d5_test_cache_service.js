describe('d5_test_cache_service', function() {

  this.timeout(20000);

  var expect = require('expect.js');

  var service = require('../lib/services/cache/service');
  var serviceInstance = new service();

  var testId = require('shortid').generate();

  var config = {};

  var async = require('async');

  before('should initialize the service', function(callback) {

    var UtilService = require('../lib/services/utils/service');
    var utilService = new UtilService();

    serviceInstance.happn = {
      services:{
        utils:utilService
      }
    };

    serviceInstance.initialize(config, callback);
  });

  after(function(done) {

    serviceInstance.stop(done);
  });

  it('sets data, default cache', function(done) {

    var key = testId + 'test1';

    serviceInstance.set(key, {"dkey":key}, function(e, result){

      if (e) return done(e);

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);

      expect(serviceInstance.__defaultCache.__cache[key].key).to.be(key);

      done();

    });
  });

  it('gets data, default cache', function(done) {

    var key = testId + 'test1';

    serviceInstance.set(key, {"dkey":key}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);

      expect(serviceInstance.__defaultCache.__cache[key].key).to.be(key);

      serviceInstance.get(key, function(e, data){

        if (e) return done(e);

        expect(data.dkey).to.be(key);
        done();

      });
    });
  });

  it('gets no data, default cache', function(done) {

    var key = testId + 'test55';

    serviceInstance.set(key, {"dkey":key}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);

      expect(serviceInstance.__defaultCache.__cache[key].key).to.be(key);

      serviceInstance.get(key + 'blah', function(e, data){

        if (e) return done(e);

        expect(data).to.be(null);
        done();

      });
    });
  });

  it('removes data, default cache', function(done) {

    var key = testId + 'test1';

    serviceInstance.set(key, {"dkey":key}, function(e, result){

      if (e) return done(e);

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);

      expect(serviceInstance.__defaultCache.__cache[key].key).to.be(key);

      serviceInstance.get(key, function(e, data){

        if (e) return done(e);

        expect(data.dkey).to.be(key);

        serviceInstance.remove(key, function(e){

          if (e) return done(e);

          serviceInstance.get(key, function(e, data){

            if (e) return done(e);

            expect(data).to.be(null);
            done();
          });
        });
      });
    });
  });

  it('retrieves unfound data, default cache', function(done) {

    var opts = {
      retrieveMethod:function(callback){
        callback(null, {data:'foundMe'});
      }
    };

    serviceInstance.get('totallyCrazyPath', opts, function(e, item){

      if (e) return done(e);

      expect(item.data).to.be('foundMe');
      expect(serviceInstance.__defaultCache.__cache['totallyCrazyPath'].data.data).to.be('foundMe');

      done();
    });
  });

  it('gets and sets data, specific cache', function(done) {

    var key = testId + 'test3';
    var specific = serviceInstance.new('specific');

    specific.set(key, {"dkey":key}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);

      expect(serviceInstance.__caches['specific'].__cache[key].key).to.be(key);

      specific.get(key, function(e, data){

        if (e) return done(e);

        expect(data.dkey).to.be(key);

        serviceInstance.clear('specific');

        done();

      });
    });
  });

  it('gets no data, specific cache', function(done) {

    var key = testId + 'test3';
    var specific = serviceInstance.new('specific-no-data');

    specific.set(key, {"dkey":key}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);

      expect(serviceInstance.__caches['specific-no-data'].__cache[key].key).to.be(key);

      specific.get('totally-non-existent', function(e, data){

        if (e) return done(e);

        expect(data).to.be(null);

        serviceInstance.clear('specific-no-data');

        done();

      });
    });
  });

  it('removes data, specific cache', function(done) {

    var key = testId + 'test3';
    var specific = serviceInstance.new('specific');

    specific.set(key, {"dkey":key}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);

      expect(serviceInstance.__caches['specific'].__cache[key].key).to.be(key);

      specific.get(key, function(e, data){

        if (e) return done(e);

        expect(data.dkey).to.be(key);

        specific.remove(key, function(e, removed){

          if (e) return done(e);

          expect(removed).to.be(true);

          specific.get(key, function(e, data){

            if (e) return done(e);

            expect(data).to.be(null);

            expect(serviceInstance.__caches['specific']).to.not.be(undefined);
            serviceInstance.clear('specific');
            expect(serviceInstance.__caches['specific']).to.be(undefined);

            done();

          });
        });
      });
    });
  });

  it('retrieves unfound data, specific cache', function(done) {

    var specific = serviceInstance.new('specific');

    var opts = {
      retrieveMethod:function(callback){
        callback(null, {data:'foundMe'});
      }
    };

    specific.get('totallyCrazyPath', opts, function(e, item){

      if (e) return done(e);

      expect(item.data).to.be('foundMe');
      expect(serviceInstance.__caches['specific'].__cache['totallyCrazyPath'].data.data).to.be('foundMe');
      done();
    });

  });

  it('times data out, default cache', function(done) {

    this.timeout(5000);

    var key = testId + 'test1';

    serviceInstance.set(key, {"dkey":key}, function(e, result){

      if (e) return done(e);

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);

      expect(serviceInstance.__caches['default'].__cache[key].key).to.be(key);

      serviceInstance.get(key, function(e, data){

        if (e) return done(e);

        expect(data.dkey).to.be(key);

        serviceInstance.set(key, {"dkey":key}, {ttl:500}, function(e, result){

          if (e) return done(e);

          setTimeout(function(){

            serviceInstance.get(key, function(e, data){

              if (e) return done(e);
              expect(data).to.be(null);

              done();

            });

          }, 1000);

        });
      });
    });

  });

  it('times data out, specific cache', function(done) {

    this.timeout(5000);
    var key = testId + 'test1';

    serviceInstance.clear('specific');

    var specific = serviceInstance.new('specific');

    specific.set(key, {"dkey":key}, {ttl:2000}, function(e){

      if (e) return done(e);

      specific.get(key, function(e, data){

        if (e) return done(e);

        expect(data).to.not.be(null);

        setTimeout(function(){

          specific.get(key, function(e, data){

            if (e) return done(e);
            expect(data).to.be(null);

            serviceInstance.clear('specific');

            done();

          });

        }, 2000);

      });
    });
  });

  it('clears the default cache', function(done){

    var key = testId + 'test1';

    serviceInstance.set(key, {"dkey":key}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);

      expect(serviceInstance.__defaultCache.__cache[key].key).to.be(key);

      serviceInstance.get(key, function(e, data){

        if (e) return done(e);

        expect(data.dkey).to.be(key);

        serviceInstance.clear('default');

        expect(Object.keys(serviceInstance.__defaultCache.__cache).length).to.be(0);

        serviceInstance.get(key, function(e, data){

          if (e) return done(e);

          if (data) return done(new Error('this was not meant to happn'));

          done();

        });
      });
    });
  });

  it('clears the specific cache', function(done){

    this.timeout(5000);
    var key = testId + 'test1';

    var specific = serviceInstance.new('specific');

    specific.set(key, {"dkey":key}, {ttl:2000}, function(e){

      if (e) return done(e);

      specific.get(key, function(e, data){

        if (e) return done(e);

        expect(data).to.not.be(null);

        expect(serviceInstance.__caches['specific']).to.not.be(undefined);

        serviceInstance.clear('specific');

        expect(serviceInstance.__caches['specific']).to.be(undefined);

        done();

      });
    });
  });

  it('clears the default cache, then sets an item on it', function(done){

    var key = testId + 'test1';

    serviceInstance.set(key, {"dkey":key}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);

      expect(serviceInstance.__defaultCache.__cache[key].key).to.be(key);

      serviceInstance.get(key, function(e, data){

        if (e) return done(e);

        expect(data.dkey).to.be(key);

        serviceInstance.clear('default');

        expect(Object.keys(serviceInstance.__defaultCache.__cache).length).to.be(0);

        serviceInstance.get(key, function(e, data){

          if (e) return done(e);

          if (data) return done(new Error('this was not meant to happn'));

          serviceInstance.set(key, {"dkey":key}, function(e, result){

            if (e) return done(e);

            serviceInstance.get(key, function(e, data){

              if (e) return done(e);
              expect(data.dkey).to.be(key);

              done();
            });
          });
        });
      });
    });
  });

  it('tests the default mechanism and update, default cache', function(done){

    serviceInstance.get('nonexistantItem', {default:{ttl:1000, value:20}}, function(e, data){

      if (e) return done(e);

      expect(data).to.be(20);

      serviceInstance.update('nonexistantItem', 30, function(e, cacheItem){

        if (e) return done(e);

        //we must preserve the metadata

        expect(cacheItem.key).to.be('nonexistantItem');
        expect(cacheItem.data).to.be(30);

        expect(cacheItem.ttl).to.not.be(null);
        expect(cacheItem.ttl).to.not.be(undefined);

        serviceInstance.get('nonexistantItem', function(e, data){

          if (e) return done(e);
          expect(data).to.be(30);

          expect(serviceInstance.__defaultCache.__cache['nonexistantItem']).to.not.be(undefined);

          var didCB = false;

          serviceInstance.on('item-timed-out', function(timed){

            try{

              if (didCB) return;

              expect(timed.item.key).to.be('nonexistantItem');

              expect(serviceInstance.__defaultCache.__cache['nonexistantItem']).to.be(undefined);

              didCB = true;

              done();

            }catch(e){
              done(e);
            }

          });
        });
      });
    });
  });


  it('tests the default mechanism and update, specific cache', function(done){

    this.timeout(5000);
    var key = testId + 'test1DefaultItemNotFound';

    serviceInstance.clear('specific');
    var specific = serviceInstance.new('specific');

    specific.get(key, {default:{value:{'nice':'value'}, ttl:1000}}, function(e, data){

      if (e) return done(e);

      expect(data).to.not.be(null);
      expect(data.nice).to.be('value');

      expect(serviceInstance.__caches['specific']).to.not.be(undefined);

      setTimeout(function(){

        specific.get(key, function(e, data){

          if (e) return done(e);

          expect(data).to.be(null);
          done();

        });

      }, 1200);


    });
  });

  it('tests the increment function, default cache', function(done){
    serviceInstance.get('nonexistantItem', {default:{ttl:1000, value:20}}, function(e, data){

      if (e) return done(e);

      expect(data).to.be(20);

      serviceInstance.increment('nonexistantItem', 30, function(e, data){

        if (e) return done(e);

        expect(data).to.be(50);
        done();

      });
    });
  });

  it('tests the increment function, specific cache', function(done){

    this.timeout(5000);
    var key = testId + 'test1DefaultItemNotFound';

    serviceInstance.clear('specific');
    var specific = serviceInstance.new('specific');

    specific.get(key, {default:{value:20, ttl:1000}}, function(e, data){

      if (e) return done(e);

      expect(data).to.not.be(null);
      expect(serviceInstance.__caches['specific']).to.not.be(undefined);

      specific.increment(key, 15, function(e, data){

        if (e) return done(e);

        expect(data).to.be(35);
        done();

      });
    });
  });

  xit('tests the all function, default cache', function(done){


  });

  it('tests the all function, specific cache', function(done){

    serviceInstance.clear('specific');
    var specific = serviceInstance.new('specific');

    async.times(5, function(time, timeCB){

      var key = "sync_key_" + time;
      var opts = {};

      if (time == 4) opts.ttl = 2000;

      specific.set(key, {"val":key}, opts, timeCB);

    }, function(e){

      if (e) return done(e);

      expect(Object.keys(specific.__cache).length).to.be(5);

      specific.all(function(e, items){

        if (e) return done(e);
        expect(items.length).to.be(5);

        expect(items[0].val).to.be("sync_key_" + 0);
        expect(items[1].val).to.be("sync_key_" + 1);
        expect(items[2].val).to.be("sync_key_" + 2);
        expect(items[3].val).to.be("sync_key_" + 3);
        expect(items[4].val).to.be("sync_key_" + 4);

        done();

      });
    });
  });

  it('tests the all function, specific cache, with a filter', function(done){

    serviceInstance.clear('specific');
    var specific = serviceInstance.new('specific');

    async.times(5, function(time, timeCB){

      var key = "sync_key_" + time;
      var opts = {};

      if (time == 4) opts.ttl = 2000;

      specific.set(key, {"val":key}, opts, timeCB);

    }, function(e){

      if (e) return done(e);

      expect(Object.keys(specific.__cache).length).to.be(5);

      specific.all({val:{$in:['sync_key_1','sync_key_2']}}, function(e, items){

        if (e) return done(e);

        expect(items.length).to.be(2);

        expect(items[0].val).to.be("sync_key_" + 1);
        expect(items[1].val).to.be("sync_key_" + 2);

        done();

      });
    });
  });
});
