var path = require('path');
var filename = path.basename(__filename);

var benchmarket = require('benchmarket');
var Promise = require('bluebird');
var expect = require('expect.js');
var Happn = require('../');

describe(filename, function() {

  benchmarket.start();

  var server, normalClient, intraProcessClient, clusterPeer;

  before(function(done) {
    Happn.service.create()
      .then(function(_server) {
        server = _server;
      })
      .then(done)
      .catch(done);
  });

  before(function(done) {
    Happn.client.create()
      .then(function(client) {
        normalClient = client;
        normalClient.onAsync = Promise.promisify(normalClient.on);
        done();
      })
      .catch(done);
  });

  before(function(done) {
    Happn.client.create({
      plugin: Happn.client_plugins.intra_process,
      context: server
    })
      .then(function(client) {
        intraProcessClient = client;
        intraProcessClient.onAsync = Promise.promisify(intraProcessClient.on);
        done();
      })
      .catch(done);
  });

  before(function(done) {
    Happn.client.create({
      info: {
        // anyone can login as a cluster peer by putting clusterName into login.info,
        // it brings no special privileges,
        // other than that they will not receive published events with the noCluster option set
        clusterName: 'cluster-name'
      }
    })
      .then(function(client) {
        clusterPeer = client;
        clusterPeer.onAsync = Promise.promisify(clusterPeer.on);
        done();
      })
      .catch(done);
  });

  after(function(done) {
    if (!normalClient) return done();
    normalClient.disconnect(done);
  });

  after(function(done) {
    if (!intraProcessClient) return done();
    intraProcessClient.disconnect(done);
  });

  after(function(done) {
    if (!clusterPeer) return done();
    clusterPeer.disconnect(done);
  });

  after(function(done) {
    if (!server) return done();
    server.stop({reconnect: false}, done);
  });

  context('on set', function() {

    it('does not emit to clusterPeer if noCluster set', function (done) {

      var emitted = {};

      Promise.resolve()

        .then(function() {
          return normalClient.onAsync('/some/path/to/set/on', function(data, meta) {
            emitted['normalClient /some/path/to/set/on'] = data;
          });
        })

        .then(function() {
          return normalClient.onAsync('/*/to/set/on', function(data, meta) {
            emitted['normalClient /*/to/set/on'] = data;
          });
        })

        .then(function() {
          return intraProcessClient.onAsync('/some/path/to/set/on', function(data, meta) {
            emitted['intraProcessClient /some/path/to/set/on'] = data;
          });
        })

        .then(function() {
          return intraProcessClient.onAsync('/*/to/set/on', function(data, meta) {
            emitted['intraProcessClient /*/to/set/on'] = data;
          });
        })

        .then(function() {
          return clusterPeer.onAsync('/some/path/to/set/on', function(data, meta) {
            emitted['clusterPeer /some/path/to/set/on'] = data;
          });
        })

        .then(function() {
          return clusterPeer.onAsync('/*/to/set/on', function(data, meta) {
            emitted['clusterPeer /*/to/set/on'] = data;
          });
        })

        .then(function() {
          return normalClient.set('/some/path/to/set/on', {some: 'data'}, {noCluster: true});
        })

        .then(function() {
          return Promise.delay(200);
        })

        .then(function() {
          expect(emitted).to.eql({
            'normalClient /some/path/to/set/on': {some: 'data'},
            'normalClient /*/to/set/on': {some: 'data'},
            'intraProcessClient /some/path/to/set/on': {some: 'data'},
            'intraProcessClient /*/to/set/on': {some: 'data'}
          })
        })

        .then(done).catch(done);

    });

  });

  context('on remove', function() {

    it('does not emit to clusterPeer if noCluster set', function(done) {

      var emitted = {};

      Promise.resolve()

        .then(function() {
          return normalClient.set('/some/path/to/remove/on', {some: 'data'});
        })

        .then(function() {
          return normalClient.onAsync('/some/path/to/remove/on', function(data, meta) {
            emitted['normalClient /some/path/to/remove/on'] = data;
          });
        })

        .then(function() {
          return normalClient.onAsync('/*/to/remove/on', function(data, meta) {
            emitted['normalClient /*/to/remove/on'] = data;
          });
        })

        .then(function() {
          return intraProcessClient.onAsync('/some/path/to/remove/on', function(data, meta) {
            emitted['intraProcessClient /some/path/to/remove/on'] = data;
          });
        })

        .then(function() {
          return intraProcessClient.onAsync('/*/to/remove/on', function(data, meta) {
            emitted['intraProcessClient /*/to/remove/on'] = data;
          });
        })

        .then(function() {
          return clusterPeer.onAsync('/some/path/to/remove/on', function(data, meta) {
            emitted['clusterPeer /some/path/to/remove/on'] = data;
          });
        })

        .then(function() {
          return clusterPeer.onAsync('/*/to/remove/on', function(data, meta) {
            emitted['clusterPeer /*/to/remove/on'] = data;
          });
        })

        .then(function() {
          return normalClient.remove('/some/path/to/remove/on', {noCluster: true});
        })

        .then(function() {
          return Promise.delay(200);
        })

        .then(function() {
          expect(emitted).to.eql({
            'normalClient /some/path/to/remove/on': {
              removed: 1
            },
            'normalClient /*/to/remove/on': {
              removed: 1
            },
            'intraProcessClient /some/path/to/remove/on': {
              removed: 1
            },
            'intraProcessClient /*/to/remove/on': {
              removed: 1
            },
          });
        })

        .then(done).catch(done);

    });

  });

  context('on tag', function() {

    it('does not emit to clusterPeer if noCluster set', function(done) {

      var emitted = {};

      Promise.resolve()

        // .then(function() {
        //   return normalClient.onAsync('/*', function(data, meta) {
        //     console.log('data', data);
        //     console.log('meta', meta);
        //   });
        // })
        //
        // .then(function() {
        //   console.log('SET\n');
        //   return normalClient.set('/some/data/to/tag', {some1: 'data1'});
        // })
        //
        // .then(function() {
        //   console.log('TAG\n');
        //   return normalClient.set('/some/data/to/tag', null, {tag: 'tagName'});
        // })
        //
        // .then(function() {
        //   return Promise.delay(200);
        // })
        //
        // .then(function() { // what's at the data?
        //   return normalClient.get('/some/data/to/tag');
        // })
        //
        // .then(function(data) {
        //   console.log('at the data', data);
        // })
        //
        // .then(function() { // what's at the tag?
        //   // return normalClient.get('/some/data/to/tag/tagName');
        //   return normalClient.get('/_TAGS/*');
        // })
        //
        // .then(function(data) {
        //   console.log('at the tag', data);
        // })
        //
        // .then(function() {
        //   // ok, so tagging does emit
        // })

        .then(function() {
          return normalClient.set('/some/data/to/tag', {some: 'data'});
        })

        .then(function() {
          return normalClient.onAsync('/some/data/to/tag', function(data, meta) {
            emitted['normalClient /some/path/to/remove/on'] = 1;
          });
        })

        // .then(function() {
        //   return normalClient.onAsync('/_TAGS/*', function(data, meta) {
        //     emitted['normalClient /_TAGS/*'] = 1;
        //   });
        // })

        .then(function() {
          return intraProcessClient.onAsync('/some/data/to/tag', function(data, meta) {
            emitted['intraProcessClient /some/path/to/remove/on'] = 1;
          });
        })

        // .then(function() {
        //   return intraProcessClient.onAsync('/_TAGS/*', function(data, meta) {
        //     emitted['intraProcessClient /_TAGS/*'] = 1;
        //   });
        // })

        .then(function() {
          return clusterPeer.onAsync('/some/data/to/tag', function(data, meta) {
            emitted['clusterPeer /some/path/to/remove/on'] = 1;
          });
        })

        // .then(function() {
        //   return clusterPeer.onAsync('/_TAGS/*', function(data, meta) {
        //     emitted['clusterPeer /_TAGS/*'] = 1;
        //   });
        // })

        .then(function() {
          return normalClient.set('/some/data/to/tag', null, {tag: 'tagName', noCluster: true});
        })

        .then(function() {
          return Promise.delay(200);
        })

        .then(function() {
          expect(emitted).to.eql({
            'normalClient /some/path/to/remove/on': 1,
            'intraProcessClient /some/path/to/remove/on': 1
          });
        })

        .then(done).catch(done);

    });

  });

  context('on merge', function() {

    it('does not emit to clusterPeer if noCluster set', function(done) {

      var emitted = {};

      Promise.resolve()

        .then(function() {
          return normalClient.set('/some/data/to/merge', {some1: 'data1'});
        })

        .then(function() {
          return normalClient.onAsync('/some/data/to/merge', function(data, meta) {
            emitted['normalClient /some/data/to/merge'] = data;
          });
        })

        .then(function() {
          return intraProcessClient.onAsync('/some/data/to/merge', function(data, meta) {
            emitted['intraProcessClient /some/data/to/merge'] = data;
          });
        })

        .then(function() {
          return clusterPeer.onAsync('/some/data/to/merge', function(data, meta) {
            emitted['clusterPeer /some/data/to/merge'] = data;
          });
        })

        .then(function() {
          return normalClient.set('/some/data/to/merge', {some2: 'data2'}, {merge: true, noCluster: true});
        })

        .then(function() {
          return Promise.delay(200);
        })

        .then(function() {
          expect(emitted).to.eql({
            'normalClient /some/data/to/merge': {
              some1: 'data1',
              some2: 'data2'
            },
            'intraProcessClient /some/data/to/merge': {
              some1: 'data1',
              some2: 'data2'
            }
          });
        })

        .then(done).catch(done);

    });

  });

  after(benchmarket.store());
  benchmarket.stop();

});
