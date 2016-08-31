describe('d5_test_cache_service', function() {

  this.timeout(20000);

  var expect = require('expect.js');

  var service = require('../lib/services/cache/service');
  var serviceInstance = new service();

  var testId = require('shortid').generate();

  var config = {

  };

  before('should initialize the service', function(callback) {

    serviceInstance.initialize(config, callback);
  });

  after(function(done) {

    serviceInstance.stop(done);
  });

  it('sets data, default cache', function(done) {

    var key = testId + 'test1';

    serviceInstance.set(key, {"dkey":key}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);
      expect(result.cache).to.be('default');

      expect(serviceInstance.__cache['default'][key].key).to.be(key);

      done();

    });

  });

  it('gets data, default cache', function(done) {

    var key = testId + 'test1';

    serviceInstance.set(key, {"dkey":key}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);
      expect(result.cache).to.be('default');

      expect(serviceInstance.__cache['default'][key].key).to.be(key);

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
      expect(result.cache).to.be('default');

      expect(serviceInstance.__cache['default'][key].key).to.be(key);

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
      expect(result.cache).to.be('default');

      expect(serviceInstance.__cache['default'][key].key).to.be(key);

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
      expect(serviceInstance.__cache['default']['totallyCrazyPath'].data.data).to.be('foundMe');
      done();
    });
  });

  it('sets data, specific cache', function(done) {

    var key = testId + 'test2';

    serviceInstance.set(key, {"dkey":key}, {cache:'specific'}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);
      expect(result.cache).to.be('specific');

      expect(serviceInstance.__cache['specific'][key].key).to.be(key);

      done();

    });

  });

  it('gets data, specific cache', function(done) {

    var key = testId + 'test3';

    serviceInstance.set(key, {"dkey":key}, {cache:'specific'}, function(e, result){

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);
      expect(result.cache).to.be('specific');

      expect(serviceInstance.__cache['specific'][key].key).to.be(key);

      serviceInstance.get(key, {cache:'specific'}, function(e, data){

        if (e) return done(e);

        expect(data.dkey).to.be(key);
        done();

      });
    });

  });

  xit('gets no data, specific cache', function(callback) {

  });

  xit('removes data, specific cache', function(callback) {
    var key = testId + 'test1';

    serviceInstance.set(key, {"dkey":key}, {cache:'specific1'}, function(e, result){

      if (e) return done(e);

      expect(result.key).to.be(key);
      expect(result.data.dkey).to.be(key);
      expect(result.cache).to.be('specific1');

      expect(serviceInstance.__cache['specific1'][key].key).to.be(key);

      serviceInstance.get(key, {cache:'specific1'}, function(e, data){

        if (e) return done(e);

        expect(data.dkey).to.be(key);

        serviceInstance.remove(key, {cache:'specific1'}, function(e, removed){

          if (e) return done(e);

          expect(removed).to.be(true);

          serviceInstance.get(key, {cache:'specific1'}, function(e, data){

            if (e) return done(e);

            expect(data).to.be(null);
            done();
          });
        });
      });
    });
  });

  xit('retrieves unfound data, specific cache', function(callback) {

  });

  xit('times data out', function(callback) {

  });

  xit('clears a cache', function(callback) {

  });


});
