var path = require('path');
var name = path.basename(__filename);
var LRU = require('lru-cache');
// var MKC = require('mkc');
var expect = require('expect.js');

var customLRUCache = function(max) {
  var data = {};
  return {
    get: function(key) {
      var val = data[key];
      if (typeof val !== 'undefined') {
        // val is defined, so mark as "most recently used"
        // by moving to back of data object using the fact
        // that objects recall key order
        //
        // NB: object key order is only preserved for non-numerical keys
        delete data[key];
        data[key] = val;
      }
      return val;
    },
    set: function(key, val) {
      data[key] = val;
      var keys = Object.keys(data);
      var deleteCount = keys.length - max;
      for (var i = 0; i < deleteCount; i++) delete data[keys[i]];
      // console.log(Object.keys(data).length);
    }
  }
};

describe(name, function() {

  context('multiple keys with lru-cache and key append', function() {

    before('create cache', function() {
      this.cache = LRU({
        max: 100,
        maxAge: 0
      });
    });

    it('processes 100000 entries with max 100', function() {

      for (var i = 0; i < 100000; i++) {
        var key1 = '/some/average/string/length/' + i;
        var key2 = '/some/other/average/string/' + i;

        var key = key1 + '##' + key2;
        var got = this.cache.get(key);
        if (typeof got === 'undefined') {
          this.cache.set(key, true);
        }
      }

    });

  });


  xcontext('multiple keys with multikey-cache', function() {
    // slower than lru-cache (not using it)

    before('create cache', function() {
      this.cache = new MKC({max: 100});
    });

    it('processes 100000 entries with max 100', function() {

      for (var i = 0; i < 100000; i++) {
        var key1 = '/some/average/string/length/' + i;
        var key2 = '/some/other/average/string/' + i;

        var got = this.cache.get({key1: key1, key: key2});
        if (typeof got === 'undefined') {
          this.cache.set({key1: key1, key: key2}, true);
        }
      }

    });

  });


  context('multiple keys with customLRUCache', function() {
    // slower than lru-cache (not using it)

    before('create cache', function() {
      this.cache = customLRUCache(100);
    });

    it('processes 100000 entries with max 100', function() {

      for (var i = 0; i < 100000; i++) {
        var key1 = '/some/average/string/length/' + i;
        var key2 = '/some/other/average/string/' + i;

        var key = key1 + '##' + key2;
        var got = this.cache.get(key);
        if (typeof got === 'undefined') {
          this.cache.set(key, true);
        }
      }

    });

    it('set() works', function() {

      var cache = customLRUCache(max = 3);

      // add 4 entries, the first should be deleted

      cache.set('/01', true);
      cache.set('/02', true);
      cache.set('/03', true);
      cache.set('/04', true);

      expect(cache.get('/01')).to.equal(undefined);
      expect(cache.get('/02')).to.equal(true);
      expect(cache.get('/03')).to.equal(true);
      expect(cache.get('/04')).to.equal(true);

    });

    it('get() works', function() {

      var cache = customLRUCache(max = 3);

      cache.set('/01', true);
      cache.set('/02', true);
      cache.set('/03', true);

      // use /01 so that it's most recently used
      expect(cache.get('/01')).to.equal(true);

      // create new entry should push off least recently used: /02
      cache.set('/04', true);

      expect(cache.get('/01')).to.equal(true);
      expect(cache.get('/02')).to.equal(undefined);
      expect(cache.get('/03')).to.equal(true);
      expect(cache.get('/04')).to.equal(true);

    });

  });

});
