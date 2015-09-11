objective('functional', function() {

  require('./start_stop')();

  context('on', function() {

    context('local', function() {

    });

    context('remote', function() {

    });

  });

  context('onAll', function() {

    context('local', function() {

    });

    context('remote', function() {

    });

  });

  context('off', function() {

    context('local', function() {

    });

    context('remote', function() {

    });

  });

  context('offAll', function() {

    context('local', function() {

    });

    context('remote', function() {

    });

  });

  context('set', function() {

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

  context('get', function() {

    before(function(done, local) {

      local.set('/up/for/grabs/obj', {key: 'value'})

      .then(function() {
        return local.set('/up/for/grabs/array', [{key1: 'value1'}, {key2: 'value2'}]);
      })

      .then(done).catch(done);

    });

    // after(function() {  // <----------BUG in objective, afterhook not running
    //   console.log('after');
    // });

    context('remote', function() {

      it('gets remote object data', function(done, remote, pubsub) {

        trace.filter = true;

        // pubsub.spy(function handle_message() {
        //   console.log('handle_message()', arguments);
        // });

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

      it('bug? tag does not save on first');


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

  context('getPaths', function() {

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

  xcontext('getChild', function() {

    context('local', function() {

      it('can get specific child after storing array', function(done, local) {

        var child;
        local.set('/with/child', [{child: 1}, {child: 2}])
        .then(function(r) {
          child = r[0];
          return local.getChild('/with/child', child._store.id)
        })
        .then(function(c) {
          console.log(c);
          done();

        })
        .catch(done);
      });

      it('can get child after setting it');

    });

    context('remote', function() {

    });

  });

  xcontext('setChild', function() {

    context('local', function() {

      it('can set specific child after storing array');

      it('can set new child in array');

      it('can set the first child at empty branch');

    });

  });

  context('setSibling', function() {

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

  context('remove', function() {

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

  });

  xcontext('removeChild', function() {

  });

  context('tagging', {
    question: 'does the creation of a tag publish a set event?'
  }, function() {

    it('can create new record and tag simultaneously');

    it('can create a new tag on existing record with no new data');

    it('can create a new tag on existing record with new data', {
      question: 'should the new data appear in the existing record and in the tag?'
    });

    it('can retrieve a tag');

    it('can replace a tag');

    it('can remove a tag');

    it('can remove multiple tags');

  });

});