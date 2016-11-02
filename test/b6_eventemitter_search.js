describe('b6_eventemitter_search', function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store());

  var happn = require('../lib/index');
  var serviceInstance;
  var searchClient;
  var expect = require('expect.js');
  var test_id = Date.now() + '_' + require('shortid').generate();
  var async = require('async');

  var getService = function (config, callback) {
    happn.service.create(config,
      callback
    );
  }

  before('it starts completely defaulted service', function (done) {

    getService({}, function (e, service) {

      if (e) return done(e);

      serviceInstance = service;
      done();

    });

  });

  after('should delete the temp data file', function (callback) {
    serviceInstance.stop(callback);
  });

  before('authenticates with the _ADMIN user, using the default password', function (done) {

    serviceInstance.services.session.localClient({username:'_ADMIN', password:'happn'})

      .then(function (clientInstance) {
        searchClient = clientInstance;
        done();
      })

      .catch(function (e) {
        done(e);
      });

  });

  it('can get using criteria', function (done) {

    searchClient.set('movie/war', {name: 'crimson tide', genre: 'war'},
      function (e, result) {

        if (e) return done(e);

        var options = {
          sort: {"name": 1}
        }

        var criteria = {
          "name": "crimson tide"
        }

        searchClient.get('movie/*', {criteria: criteria, options: options},
          function (e, result) {
            if (e) return done(e);

            expect(result.length).to.be(1);
            done();

          });

      });

  });

  //DOESNT WORK USING NEDB PLUGIN
  it('can get using criteria, limit to fields', function (done) {

    searchClient.set('movie/war/ww2', {name: 'crimson tide', genre: 'ww2'},
      function (e, result) {

        if (e) return done(e);

        var options = {
          fields: {"name": 1}
        }

        var criteria = {
          "genre": "ww2"
        }

        searchClient.get('movie/*', {criteria: criteria, options: options},
          function (e, result) {

            if (e) return done(e);

            expect(result[0].genre).to.be(undefined);
            expect(result[0].name).to.be('crimson tide');
            expect(result.length).to.be(1);

            done();

          });

      });

  });

  it('can get the latest record, without _meta', function (done) {

    this.timeout(5000);

    var indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    async.eachSeries(indexes, function (index, eachCallback) {

      searchClient.set('movie/family/' + index,
        {name: 'the black stallion', genre: 'family'},
        eachCallback);

    }, function (e) {

      if (e) return callback(e);

      var options = {
        sort: {"_meta.created": -1},
        limit: 1
      };

      var criteria = {
        "genre": "family"
      };

      var latestResult;

      searchClient.get('movie/*', {criteria: criteria, options: options},
        function (e, result) {

          if (e) return done(e);

          expect(result.length).to.be(1);

          latestResult = result[0];

          expect(latestResult._meta.created).to.not.be(null);
          expect(latestResult._meta.created).to.not.be(undefined);

          searchClient.get('movie/family/*',
            function (e, result) {

              if (e) return callback(e);

              for (var resultItemIndex in result) {

                //if (resultItemIndex == '_meta') continue;

                var resultItem = result[resultItemIndex];

                expect(resultItem._meta.created).to.not.be(null);
                expect(resultItem._meta.created).to.not.be(undefined);

                if ((resultItem._meta.path != latestResult._meta.path) && resultItem._meta.created > latestResult._meta.created)
                  return done(new Error('the latest result is not the latest result...'));

              }

              done();

            });

        });

    });

  });

  it('can get the latest record', function (done) {

    this.timeout(5000);

    var indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    async.eachSeries(indexes, function (index, eachCallback) {

      searchClient.set('movie/family/' + index,
        {name: 'the black stallion', genre: 'family'},
        eachCallback);

    }, function (e) {

      if (e) return callback(e);

      var options = {
        sort: {"_meta.created": -1},
        limit: 1
      }

      var criteria = {
        "genre": "family"
      }

      var latestResult;

      searchClient.get('movie/*', {criteria: criteria, options: options},
        function (e, result) {

          if (e) return done(e);

          expect(result.length).to.be(1);

          latestResult = result[0];

          expect(latestResult._meta.created).to.not.be(null);
          expect(latestResult._meta.created).to.not.be(undefined);

          searchClient.get('movie/family/*',
            function (e, result) {

              if (e) return callback(e);

              for (var resultItemIndex in result) {

                if (resultItemIndex == '_meta') continue;

                var resultItem = result[resultItemIndex];

                expect(resultItem._meta.created).to.not.be(null);
                expect(resultItem._meta.created).to.not.be(undefined);

                if ((resultItem._meta.path != latestResult._meta.path) && resultItem._meta.created > latestResult._meta.created)
                  return done(new Error('the latest result is not the latest result...'));

              }

              done();

            });

        });

    });

  });

  //require('benchmarket').stop();

});
