var name = process.argv[2];
var Happn = require('../../../');

Happn.client.create()

  .then(function (client) {
    process.send({
      type: 'ready'
    });
    runClient(client);
  })

  .catch(function (error) {
    process.send({
      type: 'starterror',
      name: name,
      error: error.toString()
    });
    process.exit(1);
  });


function runClient(client) {
  var count = 0;

  setInterval(function () {
    // console.log(count); // messages received per second
    process.send({
      type: 'metric',
      name: name,
      count: count
    });
    count = 0;
  }, 1000);

  client.on('/some-path/*',
    function (data) {
      count++;
    },
    function (error) {
      if (error) {
        process.send({
          type: 'starterror',
          name: name,
          error: error.toString()
        });
        console.error(error);
        process.exit(1);
      }
    }
  );

  setInterval(function () {
    client.set('/some-path/xxx', {some: 'data'}, {noStore: true},
      function (error) {
        if (error) {
          process.send({
            type: 'runerror',
            name: name,
            error: error.toString()
          });
          console.error('set error', error);
        }
      });
  }, 0);

}

