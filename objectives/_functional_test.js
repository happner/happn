objective('functional', function() {

  require('./start_stop')();

  context('on', function() {

  });

  context('off', function() {

  });

  context('offAll', function() {

  });

  context('set', function() {

    context('remote', function() {

      it('sets remote object data', function(done, remote, should) {

        data = {a:1, b:1};

        remote.set('/the/remote/garden/path', data, {}, function(e, r) {
          if (e) return done(e);

          Object.keys(r._store).should.eql(['modified', 'path', 'id']);
          Object.keys(r._event).should.eql(['type', 'status', 'published', 'id']);
          Object.keys(r).should.eql(['a', 'b', '_store', '_event']);
          done();
        });
      });

      it('sets remote array data');

    });

    context('local', function() {

      it('sets local object data', function(done, data, pubsub, local, should) {

        trace.filter = true;

        // local.spy(
        //   function performRequest() {
        //     console.log('performRequest()', arguments);
        //   },
        //   function setInternal() {
        //     console.log('setInternal()', arguments);
        //   }
        // );

        // data.spy(
        //   function upsert() {
        //     console.log('upsert()', arguments);
        //   },
        //   function upsertInternal() {
        //     console.log('upsertInternal()', arguments);
        //     trace();
        //   }
        // );

        // pubsub.spy(
        //   function publish() {
        //     console.log('publish()', arguments);
        //   },
        //   function createResponse() {
        //     console.log('createResponse()', arguments);
        //   }
        // );

        // myData = [{a:1, b:1}, {c:1, d:1}];

        console.log('TODO: Array');
        myData = {a:1, b:1};

        local.set('/the/local/garden/path', myData, {}, function(e, r) {
          if (e) return done(e);

          Object.keys(r._store).should.eql(['modified', 'path', 'id']);
          Object.keys(r._event).should.eql(['type', 'status', 'published', 'id']);
          Object.keys(r).should.eql(['a', 'b', '_store', '_event']);
          done();
        });
      });
  

      it('sets local array data');


    });

  });

  context('get', function() {

    before(function(done, local) {

      local.set('/up/for/grabs', {key: 'value'})

      .then(done).catch(done);

    });

    // after(function() {  // <----------BUG in objective, afterhook not running
    //   console.log('after');
    // });

    context('remote', function() {

      it('gets remote object data', function(done, remote, pubsub, should) {

        trace.filter = true;

        // pubsub.spy(function handle_message() {
        //   console.log('handle_message()', arguments);
        // });

        remote.get('/up/for/grabs')

        .then(function(r) {
          r[0].key.should.equal('value');
          r[0]._store.id.length // fails if no id
          done();
        })

        .catch(done);

      });

      xit('handles empty result array as not error???');


      xit('gets remote array data', function() {

      });

    });

    context('local', function() {

      it('gets local object data', function(done, local) {

        local.get('/up/for/grabs')

        .then(function(r) {
          r[0].key.should.equal('value');
          r[0]._store.id.length // fails if no id
          done();
        })

        .catch(function(e) {
          console.log('EEE', e.stack);
          done(e);
        });
        
      });

      it('gets local array data', function() {
        
      });

    });

  });

  context('getPaths', function() {

  });

  context('getChild', function() {

  });

  context('setChild', function() {

  });

  context('setSibling', function() {

  });

  context('remove', function() {

  });

  context('removeChild', function() {

  });

});