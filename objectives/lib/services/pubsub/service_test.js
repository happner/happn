objective.only('pubsub service', function() {

  require('../../../start_stop');

  context('non wildcard subscriptions', function() {

    it('receives events', function(done, data, local, remote, Promise) {

      var received = {
        local: false,
        remote: false
      }

      Promise.all([
        local.on('/event1', function(data, meta) {
          if (data.key == 'event1') received.local = true;
        }),
        remote.on('/event1', function(data, meta) {
          if (data.key == 'event1') received.remote = true;
        }),
      ])

      .then(function() {

        // reset

        received = {
          local: false,
          remote: false
        };

        return new Promise(function(resolve, reject) {

          // set from remote

          remote.set('/event1', {key: 'event1'})

          .then(function() {

            // wait for both received

            var interval = setInterval(function() {

              if (received.local && received.remote) {
                clearInterval(interval);
                resolve();
              }

            }, 10);

          })

          .catch(reject);
        });
      })

      .then(function() {

        // reset

        received = {
          local: false,
          remote: false
        };

        return new Promise(function(resolve, reject) {

          // set from local

          local.set('/event1', {key: 'event1'})

          .then(function() {

            // wait for both received

            var interval = setInterval(function() {

              if (received.local && received.remote) {
                clearInterval(interval);
                resolve();
              }

            }, 10);

          })

          .catch(reject);
        });
      })

      .then(done).catch(function(e) {
        if (! e instanceof Error) {
          console.log('NonError', e);
          return done(new Error())
        }
        done(e);
      });
    });
  });


});
