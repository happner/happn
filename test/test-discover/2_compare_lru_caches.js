var path = require('path');
var name = path.basename(__filename);
var LRU = require('lru-cache');
var MKC = require('mkc');

describe(name, function() {

  context('multiple keys with lru-cache and key append', function() {

    before('create cache', function() {
      this.cache = LRU({
        max: 10,
        maxAge: 0
      });
    });

    it('processes 10000 entries with max 10', function() {

      for (var i = 0; i < 10000; i++) {
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


  context('multiple keys with multikey-cache', function() {

    before('create cache', function() {
      this.cache = new MKC({max: 10});
    });

    it('processes 10000 entries with max 10', function() {

      for (var i = 0; i < 10000; i++) {
        var key1 = '/some/average/string/length/' + i;
        var key2 = '/some/other/average/string/' + i;

        var got = this.cache.get({key1: key1, key: key2});
        if (typeof got === 'undefined') {
          this.cache.set({key1: key1, key: key2}, true);
        }
      }

    });

  });



});
