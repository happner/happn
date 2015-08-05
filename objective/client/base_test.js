objective('client base', function(chai) {

  var should = chai.should();
  async = require('async'); // specifically no var pending: https://github.com/FieldServer/happn/issues/9

  var LOGIN_RESPONSE = { 
    type: 'response',
    status: 'ok',
    payload: {
      token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJkYXRhIjp7fSwiaWQiOiI0SmU1Rmp0NSIsInRpbWVzdGFtcCI6MTQzODY5MTA1NCwiZXhwaXJlcyI6MCwidHRsIjowfQ.kbif_zLUEyzbzU8O9YDdMPJ9Gqc7eL9gk5avVkfDU78',
      index: 2 
    },
    published: false,
    eventId: 1 
  };

  var RECONNECTION_MESSAGE = {
    'reconnect timeout': 30000,
    retries: 10,
    factor: 2,
    max: Infinity,
    min: 500,
    start: 1438697328594,
    duration: 4370,
    attempt: 3,
    backoff: false,
    scheduled: 2804 
  }

  before(function(done, primus, Base) {

    options = {
      config: {
        host: 'localhost',
        port: 3001,
        authTokenSecret: 'a256a2fd43bf441483c5177fc85fd9d3',
        secret: 'SEcREt',
      }
    }

    var _this = this;

    function StubSocket() {
      _this.socketInstance = this;
      this.handlers = {}
    }

    StubSocket.prototype.on = function(event, handler) {
      // console.log("add handler '%s'", event)
      this.handlers[event] = handler;
    }

    StubSocket.prototype.write = function(message) {
      // console.log("writing message", message);
      if (message.action == 'login') this.handlers.data(LOGIN_RESPONSE)
    }
                    
    primus.stub(
      function createSocket() {
        return StubSocket;
      }
    );

    mock('client', new Base(options, function(e) {
      if (e) return done(e);
      done();
    }));

  });

  context('ready', function() {
    it('got client', function(done, client) {
      this.timeout(2000000)
      // console.log('with handlers', Object.keys(this.socketInstance.handlers));
      // console.log(client);
      done();
    });
  });


  context('handle_reconnection()', function() {

    it('calls authenticate', function(done, client) {
      client.does(function authenticate() {
        done()
      });
      this.socketInstance.handlers.reconnected(RECONNECTION_MESSAGE);
    });

    it('does not create a new socket instance', function() {



      this.socketInstance.MARK = 1;
      this.socketInstance.handlers.reconnected(RECONNECTION_MESSAGE);
      should.exist(this.socketInstance.MARK);
    });


  });



});