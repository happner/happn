objective('happn', function() {

  require('./start_stop');

  context('control data', function() {

    context('error', function() {

      it('does not hide the _event but does hide _store');

    });

    context('ok', function() {

      it('hides both the _event and the _store');

    });

  });

  context('on()', function() {

    context('local', function() {

      it('subscribes to all events on a path', function(done, local) {

        var collect = [];

        local.on('/pending/set/one', function(data) {

          // intra-process has sme object on client and server
          // need to deep copy this before the set callback
          // assembles it's result object on it. 
          collect.push(JSON.parse(JSON.stringify(data)));
        })

        .then(function() {
          return local.set('/pending/set/one', {key: 'value1'})
        })

        .then(function() {
          return local.set('/pending/set/one', {key: 'value2', key2: 'merge?'}, {merge: true})
        })

        .then(function() {
          return local.remove('/pending/set/one')
        })

        .then(function() {

          // console.log(collect);

          collect[0].key.should.equal('value1');
          collect[0]._store.modified.length;
          collect[0]._store.path.should.equal('/pending/set/one');
          collect[0]._store.id.length;
          collect[0]._event.timestamp.length; // mostly duplicate of _store.modified
                                             // except in case of delete
          collect[0]._event.action.should.equal('/SET@/pending/set/one');   
          collect[0]._event.type.should.equal('data');
          collect[0]._event.id.length;
          collect[0]._event.channel.should.equal('/ALL@/pending/set/one');

          // console.log(collect[1]);

          collect[1].key.should.equal('value2');
          collect[1].key2.should.equal('merge?');
          collect[1]._store.modified.length;
          collect[1]._store.path.should.equal('/pending/set/one');
          // collect[1]._store.id.length; // missing on merge
          collect[1]._event.timestamp.length;
          collect[1]._event.action.should.equal('/SET@/pending/set/one');   
          collect[1]._event.type.should.equal('data');
          collect[1]._event.id.length;
          collect[1]._event.channel.should.equal('/ALL@/pending/set/one');

          collect[2].removed.should.equal(1);
          collect[2]._store.path.should.equal('/pending/set/one');
          collect[2]._event.timestamp.length;
          collect[2]._event.action.should.equal('/REMOVE@/pending/set/one');   
          collect[2]._event.type.should.equal('data');
          collect[2]._event.id.length;
          collect[2]._event.channel.should.equal('/ALL@/pending/set/one');

          done();

        })

        .catch(done);

      })

      it('subscribes to only set events on a path', function(done, local) {

        var collect = [];

        local.on('/pending/set/two', {event_type: 'set'}, function(data) {
          collect.push(JSON.parse(JSON.stringify(data)));
        })

        .then(function() {
          return local.set('/pending/set/two', {key: 'value1'})
        })

        .then(function() {
          return local.set('/pending/set/two', {key: 'value2'})
        })

        .then(function() {
          return local.remove('/pending/set/two')
        })

        .then(function() {

          // console.log(collect);

          collect[0].key.should.equal('value1');
          collect[0]._store.modified.length;
          collect[0]._store.path.should.equal('/pending/set/two');
          collect[0]._store.id.length;
          collect[0]._event.timestamp.length; // mostly duplicate of _store.modified
                                             // except in case of delete
          collect[0]._event.action.should.equal('/SET@/pending/set/two');   
          collect[0]._event.type.should.equal('data');
          collect[0]._event.id.length;
          collect[0]._event.channel.should.equal('/SET@/pending/set/two');

          collect[1].key.should.equal('value2');
          collect[1]._store.modified.length;
          collect[1]._store.path.should.equal('/pending/set/two');
          collect[1]._store.id.length;
          collect[1]._event.timestamp.length;
          collect[1]._event.action.should.equal('/SET@/pending/set/two');   
          collect[1]._event.type.should.equal('data');
          collect[1]._event.id.length;
          collect[1]._event.channel.should.equal('/SET@/pending/set/two');

          collect.length.should.equal(2);

          done();

        })

        .catch(done);

      })

      it('subscribes to only remove events on a path', function(done, local) {

        var collect = [];

        local.on('/pending/set/three', {event_type: 'remove'}, function(data) {
          collect.push(JSON.parse(JSON.stringify(data)));
        })

        .then(function() {
          return local.set('/pending/set/three', {key: 'value1'})
        })

        .then(function() {
          return local.set('/pending/set/three', {key: 'value2'})
        })

        .then(function() {
          return local.remove('/pending/set/three')
        })

        .then(function() {

          // console.log(collect);

          collect[0].removed.should.equal(1);
          collect[0]._store.path.should.equal('/pending/set/three');
          collect[0]._event.timestamp.length;
          collect[0]._event.action.should.equal('/REMOVE@/pending/set/three');   
          collect[0]._event.type.should.equal('data');
          collect[0]._event.id.length;
          collect[0]._event.channel.should.equal('/REMOVE@/pending/set/three');

          collect.length.should.equal(1);

          done();

        })

        .catch(done);

      });
  
      it('has a usefull callback', function(done, local) {

        local.on('/one/two/three', function() {})
        .then(function(r) {
           // r is the handlerId, can be used to remove listener
           done();
        })
        .catch(done);

      });
      
    
    });

    context('remote', function() {


      it('subscribes to all events on a path', function(done, remote) {

        var collect = [];

        remote.on('/pending/set/four', function(data) {

          // intra-process has sme object on client and server
          // need to deep copy this before the set callback
          // assembles it's result object on it. 
          collect.push(JSON.parse(JSON.stringify(data)));
        })

        .then(function() {
          return remote.set('/pending/set/four', {key: 'value1'})
        })

        .then(function() {
          return remote.set('/pending/set/four', {key: 'value2', key2: 'merge?'}, {merge: true})
        })

        .then(function() {
          return remote.remove('/pending/set/four')
        })

        .then(function() {

          // console.log(collect);

          collect[0].key.should.equal('value1');
          collect[0]._store.modified.length;
          collect[0]._store.path.should.equal('/pending/set/four');
          collect[0]._store.id.length;
          collect[0]._event.timestamp.length; // mostly duplicate of _store.modified
                                             // except in case of delete
          collect[0]._event.action.should.equal('/SET@/pending/set/four');   
          collect[0]._event.type.should.equal('data');
          collect[0]._event.id.length;
          collect[0]._event.channel.should.equal('/ALL@/pending/set/four');

          // console.log(collect[1]);

          collect[1].key.should.equal('value2');
          collect[1].key2.should.equal('merge?');
          collect[1]._store.modified.length;
          collect[1]._store.path.should.equal('/pending/set/four');
          // collect[1]._store.id.length; // missing on merge
          collect[1]._event.timestamp.length;
          collect[1]._event.action.should.equal('/SET@/pending/set/four');   
          collect[1]._event.type.should.equal('data');
          collect[1]._event.id.length;
          collect[1]._event.channel.should.equal('/ALL@/pending/set/four');

          collect[2].removed.should.equal(1);
          collect[2]._store.path.should.equal('/pending/set/four');
          collect[2]._event.timestamp.length;
          collect[2]._event.action.should.equal('/REMOVE@/pending/set/four');   
          collect[2]._event.type.should.equal('data');
          collect[2]._event.id.length;
          collect[2]._event.channel.should.equal('/ALL@/pending/set/four');

          done();

        })

        .catch(done);

      })

      it('subscribes to only set events on a path', function(done, remote) {

        var collect = [];

        remote.on('/pending/set/five', {event_type: 'set'}, function(data) {
          collect.push(JSON.parse(JSON.stringify(data)));
        })

        .then(function() {
          return remote.set('/pending/set/five', {key: 'value1'})
        })

        .then(function() {
          return remote.set('/pending/set/five', {key: 'value2'})
        })

        .then(function() {
          return remote.remove('/pending/set/five')
        })

        .then(function() {

          // console.log(collect);

          collect[0].key.should.equal('value1');
          collect[0]._store.modified.length;
          collect[0]._store.path.should.equal('/pending/set/five');
          collect[0]._store.id.length;
          collect[0]._event.timestamp.length; // mostly duplicate of _store.modified
                                             // except in case of delete
          collect[0]._event.action.should.equal('/SET@/pending/set/five');   
          collect[0]._event.type.should.equal('data');
          collect[0]._event.id.length;
          collect[0]._event.channel.should.equal('/SET@/pending/set/five');

          collect[1].key.should.equal('value2');
          collect[1]._store.modified.length;
          collect[1]._store.path.should.equal('/pending/set/five');
          collect[1]._store.id.length;
          collect[1]._event.timestamp.length;
          collect[1]._event.action.should.equal('/SET@/pending/set/five');   
          collect[1]._event.type.should.equal('data');
          collect[1]._event.id.length;
          collect[1]._event.channel.should.equal('/SET@/pending/set/five');

          collect.length.should.equal(2);

          done();

        })

        .catch(done);

      })

      it('subscribes to only remove events on a path', function(done, remote) {

        var collect = [];

        remote.on('/pending/set/six', {event_type: 'remove'}, function(data) {
          collect.push(JSON.parse(JSON.stringify(data)));
        })

        .then(function() {
          return remote.set('/pending/set/six', {key: 'value1'})
        })

        .then(function() {
          return remote.set('/pending/set/six', {key: 'value2'})
        })

        .then(function() {
          return remote.remove('/pending/set/six')
        })

        .then(function() {

          // console.log(collect);

          collect[0].removed.should.equal(1);
          collect[0]._store.path.should.equal('/pending/set/six');
          collect[0]._event.timestamp.length;
          collect[0]._event.action.should.equal('/REMOVE@/pending/set/six');   
          collect[0]._event.type.should.equal('data');
          collect[0]._event.id.length;
          collect[0]._event.channel.should.equal('/REMOVE@/pending/set/six');

          collect.length.should.equal(1);

          done();

        })

        .catch(done);

      })


    });

  });

  context('onAll()', function() {

    context('local', function() {

    });

    context('remote', function() {

    });

  });

  context('off()', function() {

    context('local', function() {

      it('removes all subscriptions from a path from local', function(done, local) {

        var collect = [];

        local.on('/temp1/sub/one', function(data) {
          collect.push(JSON.parse(JSON.stringify(data)));
        })

        .then(function(r) {
          // subscribe a second time
          return local.on('/temp1/sub/one', function(data) {
            collect.push(JSON.parse(JSON.stringify(data)));
          })
        })

        .then(function() {
          return local.set('/temp1/sub/one', {key: 1})
        })

        .then(function() {
          collect.length.should.equal(2);
          // unsubscribe
          return local.off('/temp1/sub/one') // unsub
        })

        .then(function(r) {
          // console.log('off result', r);
          return local.set('/temp1/sub/one', {key: 1});
        })

        .then(function() {
          collect.length.should.equal(2);
          done();
        })

        .catch(done);

      });

      it('removes a specific subscription from local', function(local, done) {

        var collect = [];
        var id1, id2;

        local.on('/temp2/sub/one', function(data) {
          collect.push(JSON.parse(JSON.stringify(data)));
        })

        .then(function(id) {
          id1 = id;
          return local.on('/temp2/sub/one', function(data) {
            collect.push(JSON.parse(JSON.stringify(data)));
          })
        })

        .then(function(id) {
          id2 = id;
          return local.set('/temp2/sub/one', {key: 1})
        })

        .then(function() {
          collect.length.should.equal(2);
          // unsubscribe
          return local.off(id1) // unsub
        })

        .then(function(r) {
          // console.log('off result', r);
          return local.set('/temp2/sub/one', {key: 1});
        })

        .then(function() {
          collect.length.should.equal(3);
          done();
        })

        .catch(done);

      });

      xit('has a usefull callback')


    });

    context('remote', function() {

      it('removes all subscriptions from a path from remote', function(done, remote) {

        var collect = [];

        remote.on('/temp1/sub/one', function(data) {
          collect.push(JSON.parse(JSON.stringify(data)));
        })

        .then(function(r) {
          return remote.on('/temp1/sub/one', function(data) {
            collect.push(JSON.parse(JSON.stringify(data)));
          })
        })

        .then(function() {
          return remote.set('/temp1/sub/one', {key: 1})
        })

        .then(function() {
          collect.length.should.equal(2);
          return remote.off('/temp1/sub/one') // unsub
        })

        .then(function() {
          return remote.set('/temp1/sub/one', {key: 1});
        })

        .then(function() {
          collect.length.should.equal(2);
          done();
        })

        .catch(done);

      });

      it('removes a specific subscription from remote', function(remote, done) {

        var collect = [];
        var id1, id2;

        remote.on('/temp2/sub/one', function(data) {
          collect.push(JSON.parse(JSON.stringify(data)));
        })

        .then(function(id) {
          id1 = id;
          return remote.on('/temp2/sub/one', function(data) {
            collect.push(JSON.parse(JSON.stringify(data)));
          })
        })

        .then(function(id) {
          id2 = id;
          return remote.set('/temp2/sub/one', {key: 1})
        })

        .then(function() {
          collect.length.should.equal(2);
          return remote.off(id1) // unsub
        })

        .then(function(r) {
          return remote.set('/temp2/sub/one', {key: 1});
        })

        .then(function() {
          collect.length.should.equal(3);
          done();
        })

        .catch(done);

      });

      xit('has a usefull callback')


    });

  });

  context('offAll()', function() {

    context('local', function() {

    });

    context('remote', function() {

    });

  });

  context('set()', function() {

    context('remote', function() {

      it('sets remote object data', function(done, remote) {

        var data = {a:1, b:2};

        remote.set('/the/remote/garden/path', data, {}, function(e, r) {
          if (e) return done(e);

          r._store.path.should.equal('/the/remote/garden/path');
          r._store.id.length;
          r._store.modified.length;

          r._event.type.length;
          r._event.status.length;
          r._event.published.length;
          r._event.id.length;

          r.a.should.equal(1);
          r.b.should.equal(2);
          done();
        });
      });

      it('sets remote array data', function(done, remote, Should) {

        var myData = [{a:1, b:1}, {c:1, d:1}];

        trace.filter = true;

        remote.set('/my/array', myData)

        .then(function(r) {

          r[0].a.should.eql(1);
          r[0].b.should.eql(1);
          r[1].c.should.eql(1);
          r[1].d.should.eql(1);

          Should.not.exist(r[0]._store);
          Should.not.exist(r[1]._store);

          r._store.modified.length;
          r._store.id.length;
          r._store.path.length;

          r._event.type.length;
          r._event.status.length;
          r._event.published.length;
          r._event.id.length;
          done();

        })

        .catch(done);
      });

      xit('has a created date, second save preserves created date');

    });
    

    context('local', function() {

      it('sets local object data', function(done, local) {

        var data = {a:1, b:2};

        local.set('/the/local/garden/path', data, {}, function(e, r) {
          if (e) return done(e);

          r._store.path.should.equal('/the/local/garden/path');
          r._store.id.length;
          r._store.modified.length;

          r._event.type.length;
          r._event.status.length;
          r._event.published.length;
          r._event.id.length;

          r.a.should.equal(1);
          r.b.should.equal(2);
          done();
        });
      });

      it('sets local array data', function(done, local) {

        var myData = [{a:1, b:1}, {c:1, d:1}];

        local.set('/my/array', myData)

        .then(function(r) {

          r[0].should.eql({a:1, b:1});
          r[1].should.eql({c:1, d:1});

          r._store.modified.length;
          r._store.id.length;
          r._store.path.length;

          r._event.type.length;
          r._event.status.length;
          r._event.published.length;
          r._event.id.length;
          done();

        })

        .catch(done);
      });

      xit('has a created date, second save preserves created date');

    });


  });

  context('get()', function() {

    before(function(done, local) {

      console.log('GET before');

      local.set('/up/for/grabs/obj', {key: 'value'})

      .then(function() {
        return local.set('/up/for/grabs/array', [{key1: 'value1'}, {key2: 'value2'}]);
      })

      .then(done).catch(done);

    });

    context('remote', function() {

      it('gets remote object data', function(done, remote, pubsub) {

        trace.filter = true;

        remote.get('/up/for/grabs/obj')

        .then(function(r) {
          r.key.should.equal('value');
          r._store.id.length // fails if no id
          done();
        })

        .catch(done);

      });

      xit('handles empty result array as not error');


      it('gets remote array data', function(done, remote) {

        trace.filter = true;

        remote.get('/up/for/grabs/array')

        .then(function(r) {

          r[0].key1.should.eql('value1');
          r[1].key2.should.eql('value2');

          r._store.id.length;
          r._store.path.length;
          r._store.modified.length;
          r._event.type.length;
          r._event.status.length;
          r._event.published.length;
          r._event.id.length;
          done();
        })

        .catch(done);
      });

      it('can get remote with *', function(done, remote) {

        remote.set('/at/path/one', {xxx: 'one'})

        .then(function() {

          return remote.set('/at/path/two', {xxx: 'two'})

        })

        .then(function() {

          return remote.get('/at/path/*')

          .then(function(r) {

            r._event.type.length;

            r[0].xxx.length
            r[1].xxx.length;

            r[0]._store.id.length
            r[0]._store.path.length
            // r[0]._store.created.length
            r[0]._store.modified.length

            r[1]._store.id.length
            r[1]._store.path.length
            // r[1]._store.created.length
            r[1]._store.modified.length

            done()
          });

        })

        .catch(done);

      });

      xit('keeps the created date', function(done, remote) {

        var created;

        remote.set('/keeps/created', {data: 'DATA'})

        .then(function(r) {
          created = r._store.created;
          return remote.set('/keeps/created',r)  /// as existing?
          return remote.set('/keeps/created', {data: 'DATA'})  /// as new?
        })

        .then(function(r) {

          console.log('CREATED', created);
          console.log('CREATED', r._store.created);

        })

        .catch(done);

      });

    });

    context('local', function() {

      it('gets local object data', function(done, local) {

        local.get('/up/for/grabs/obj')

        .then(function(r) {

          r.key.should.equal('value');
          r._store.id.length // fails if no id
          r._store.path.length
          r._store.modified.length
          done();
        })

        .catch(done);
      });

      it('gets local array data', function(done, local) {

        trace.filter = true;

        local.get('/up/for/grabs/array')

        .then(function(r) {

          r[0].should.eql({key1: 'value1'});
          r[1].should.eql({key2: 'value2'});

          r._store.id.length;
          r._store.path.length;
          r._store.modified.length;
          r._event.type.length;
          r._event.status.length;
          r._event.published.length;
          r._event.id.length;
          done();
        })

        .catch(done);
      });

      xit('handles empty result array as not error');

      it('can get local with *', function(done, local) {

        local.set('/at/path/one', {xxx: 'one'})

        .then(function() {

          return local.set('/at/path/two', {xxx: 'two'})

        })

        .then(function() {

          return local.get('/at/path/*')

          .then(function(r) {

            r._event.type.length;

            r[0].xxx.length
            r[1].xxx.length;

            r[0]._store.id.length
            r[0]._store.path.length
            // r[0]._store.created.length
            r[0]._store.modified.length

            r[1]._store.id.length
            r[1]._store.path.length
            // r[1]._store.created.length
            r[1]._store.modified.length

            done()
          });

        })

        .catch(done);

      });

    });

  });

  context('getPaths()', function() {

    context('local', function() {

      it('gets path with wildcards', function(done, local, Promise) {

        Promise.all([
          local.set('/wildcard/path/one',   {data: 1}),
          local.set('/wildcard/path/two',   {data: 2}),
          local.set('/wildcard/path/three', {data: 3}),
          local.set('/wildcard/path/four',  {data: 4}),
          local.set('/wildcard/path/five',  {data: 5})
        ])

        .then(function() {

          // return local.getPaths('/wildcar*');
          return local.getPaths('/wildcard/*');

        })

        .then(function(r) {

          r.map(function(item) {
            return item.path;
          }).sort(function(a, b) {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
          }).should.eql([
            '/wildcard/path/five',
            '/wildcard/path/four', 
            '/wildcard/path/one',   
            '/wildcard/path/three', 
            '/wildcard/path/two',   
          ]);

          done();

        })

        .catch(done);
      });

    });

    context('remote', function() {

      it('gets path with wildcards', function(done, remote, Promise, expect) {

        trace.filter = true;

        Promise.all([
          remote.set('/mildcard/path/one',   {data: 1}),
          remote.set('/mildcard/path/two',   {data: 2}),
          remote.set('/mildcard/path/three', {data: 3}),
          remote.set('/mildcard/path/four',  {data: 4}),
          remote.set('/mildcard/path/five',  {data: 5})
        ])

        .then(function() {

          // return local.getPaths('/wildcar*');
          return remote.getPaths('/mildcard/*');

        })

        .then(function(r) {

          // require('should'); //!!!!!  WTF

          var sort = r.map(function(item) {
            return item.path;
          }).sort(function(a, b) {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
          });

          // console.log('xxx' , sort.should);

          // should is (semi) broken in callback /?or?/ promise from websocket

          expect(sort).to.eql([
            '/mildcard/path/five',
            '/mildcard/path/four', 
            '/mildcard/path/one',   
            '/mildcard/path/three', 
            '/mildcard/path/two',   
          ]);

          done();

        })

        .catch(done);

      });

    });

  });

  context('setSibling()', function() {

    context('local', function() {

      it('it creates a sibling from local', function(done, local) {

        local.setSibling('/for/sibling', {the: 'SIBLING'})

        .then(function(r) {
          r.the.should.equal('SIBLING');
          r._store.modified.length;
          r._store.path.length;
          r._store.id.length;
          r._event.type.length;
          r._event.status.length;
          r._event.published.length;
          r._event.id.length;
          r._store.path.split('/').length.should.equal(4);
          done();
        })

        .catch(done);

      });

    });


    context('remote', function() {

      it('it creates a sibling from remote', function(done, remote) {

        remote.setSibling('/for/sibling', {the: 'SIBLING'})

        .then(function(r) {
          r.the.should.equal('SIBLING');
          r._store.modified.length;
          r._store.path.length;
          r._store.id.length;
          r._event.type.length;
          r._event.status.length;
          r._event.published.length;
          r._event.id.length;
          r._store.path.split('/').length.should.equal(4);
          done();
        })

        .catch(done);

      });

    });

  });

  context('remove()', function() {

    context('local', function() {

      it('removes one from local', function(done, local) {

        trace.filter = true;

        local.set('/pending/remove', {data: 'DATA'})

        .then(function() {
          return local.get('/pending/remove')
        })

        .then(function(got) {
          return local.remove('/pending/remove')
        })

        .then(function(r) {
          r.removed.should.equal(1);
          done();
        })

        .catch(done);

      });

      it('removes many from local', function(done, local, Promise) {

        trace.filter = true;

        Promise.all([
          local.set('/pending/multiple/remove/a', {data: 'DATA'}),
          local.set('/pending/multiple/remove/b', {data: 'DATA'}),
          local.set('/pending/multiple/remove/c', {data: 'DATA'}),
          local.set('/pending/multiple/remove/d', {data: 'DATA'}),
        ])

        .then(function() {
          return local.remove('/pending/multiple/remove/*')
        })

        .then(function(r) {
          r.removed.should.equal(4);
          done();
        })

        .catch(done);

      });

    });

    context('remote', function() {

      it('removes one from remote', function(done, remote) {

        trace.filter = true;

        remote.set('/pending2/remove', {data: 'DATA'})

        .then(function() {
          return remote.get('/pending2/remove')
        })

        .then(function(got) {
          return remote.remove('/pending2/remove')
        })

        .then(function(r) {
          r.removed.should.equal(1);
          done();
        })

        .catch(done);

      });

      it('removes many from local', function(done, remote, Promise) {

        trace.filter = true;

        Promise.all([
          remote.set('/pending2/multiple/remove/a', {data: 'DATA'}),
          remote.set('/pending2/multiple/remove/b', {data: 'DATA'}),
          remote.set('/pending2/multiple/remove/c', {data: 'DATA'}),
          remote.set('/pending2/multiple/remove/d', {data: 'DATA'}),
        ])

        .then(function() {
          return remote.remove('/pending2/multiple/remove/*')
        })

        .then(function(r) {
          r.removed.should.equal(4);
          done();
        })

        .catch(done);

      });

    });

  });


  context('tagging()', function() {

    context('local',  function() {

      it('can create a new tag on existing record with no new data', function(done, local, expect) {

        local.set('/patha/item/1', {key: 'value'})

        .then(function(r) {
          return local.set('/patha/item/1', null, {tag: 'tagname'});
        })

        .then(function(r) {
          expect(r.snapshot.data).to.eql({key: 'value'});
          done();
        })

        .catch(function(e) {
          console.log(e);
          done(e);
        });

      });

      xit('can create a new tag on existing record with new data', {
        question: 'should the new data appear in the existing record and in the tag?'
      });

      // it.only('can retrieve a tag', function(done) {
      //   console.log('RUN!');
      //   done();
      // });
      // it.only('can retrieve a tag 1', function(done) {
      //   done();
      // });

      xit('can replace a tag');

      xit('can remove a tag');

      xit('can remove multiple tags');

    });

    context('remote',  function() {

      it('can create a new tag on existing record with no new data', function(done, remote, expect) {

        remote.set('/pathb/item/1', {key: 'value'})

        .then(function(r) {
          return remote.set('/pathb/item/1', null, {tag: 'tagname'});
        })

        .then(function(r) {
          expect(r.snapshot.data).to.eql({key: 'value'});
          done();
        })

        .catch(done);

      });

      xit('can create a new tag on existing record with new data');

      it('can retrieve a tag');

      xit('can replace a tag');

      xit('can remove a tag');

      xit('can remove multiple tags');

    });

  });

  context('merging', function() {

    context('local', function() {

      xit('merges at path', function(done, local) {

        local.set('/for/local/merge', {key1: 1, key2: 2})

        .then(function() {
          return local.set('/for/local/merge', {key1: 'one', key3: 3}, {merge: true})
        })

        .then(function(r) {

          r.key1.should.equal('one');
          r.key2.should.equal(2);
          r.key3.should.equal(3);

          r._event.type.length;
          r._event.status.length;
          r._event.published.length;
          r._event.id.length;

          r._store.modified.length;
          r._store.path.length;
          r._store.id.length;

          done();

        })

        .catch(done);

      });

    });

    context('remote', function() {

      xit('merges at path', function(done, remote) {

        remote.set('/for/remote/merge', {key1: 1, key2: 2})

        .then(function() {
          return remote.set('/for/remote/merge', {key1: 'one', key3: 3}, {merge: true})
        })

        .then(function(r) {

          r.key1.should.equal('one');
          r.key2.should.equal(2);
          r.key3.should.equal(3);

          r._event.type.length;
          r._event.status.length;
          r._event.published.length;
          r._event.id.length;

          r._store.modified.length;
          r._store.path.length;
          r._store.id.length;

          done();

        })

        .catch(done);

      });

    });

  });

});
