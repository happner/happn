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

    xcontext('remote', function() {

      it('sets data at some path', function(done, remote) {

        data = {a:1, b:1};

        remote.set('/the/remote/garden/path', data, {}, function(e, r) {
          console.log(e);
          console.log(r);
          done();
        });
      });
    });

    context('local', function() {

      it('sets data at some path', function(done, data, pubsub, local) {

        data.spy(
          function upsert() {
            console.log('upsert()', arguments);
          },
          function upsertInternal() {
            console.log('upsertInternal()', arguments);
            // trace();
          }
        );

        pubsub.spy(function publish() {
          console.log('publish()', arguments);
        });

        myData = {a:1, b:1};

        local.set('/the/local/garden/path', myData, {}, function(e, r) {
          console.log(e);
          console.log(r);
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