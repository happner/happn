objective('functional', function() {

  require('./start_stop')();

  context('on', function() {

  });

  context('off', function() {

  });

  context('offAll', function() {

  });

  context('get', function() {

  });

  context('getPaths', function() {

  });

  context('getChild', function() {

  });



  context('set', function() {

    context('remote', function() {

      it('sets data at some path', function(done, remote, should) {

        data = {a:1, b:1};

        remote.set('/the/remote/garden/path', data, {}, function(e, r) {
          if (e) return done(e);

          Object.keys(r._).should.eql(['modified', 'path', 'id', 'type', 'status', 'published', 'eventId']);
          Object.keys(r).should.eql(['a', 'b', '_']);
          done();
        });
      });
    });

    context('local', function() {

      it('sets data at some path', function(done, data, pubsub, local, should) {

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

          Object.keys(r._).should.eql(['modified', 'path', 'id', 'type', 'status', 'published', 'eventId']);
          Object.keys(r).should.eql(['a', 'b', '_']);
          // console.log(JSON.stringify(r, null, 2));
          done();
        });
      });


    });




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