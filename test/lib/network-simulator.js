/*
 * Proxy that mimics a network with:
 * 1. real latency and
 * 2. large payload transmission-time simulation
 * 3. network outage simulation
 */

module.exports = NetworkSimulator;

var net = require('net');
var Promise = require('bluebird');

function NetworkSimulator(opts) {
  this.log = opts.log;
  this.latency = opts.latency;
  this.forwardToPort = opts.forwardToPort;
  this.listenPort = opts.listenPort;
  this.sockets = [];
  this.networkSegmentation = false;
}

NetworkSimulator.prototype.start = function () {
  var _this = this;
  return new Promise(function (resolve, reject) {
    _this.server = net.createServer();

    function onError(error) {
      _this.server.removeListener('listening', onListening);
      reject(error);
    }

    function onListening() {
      _this.server.removeListener('error', onError);
      resolve();
    }

    _this.server.once('error', onError);
    _this.server.once('listening', onListening);
    _this.server.on('connection', _this._handleConnection.bind(_this));

    _this.server.listen(_this.listenPort);
  });
};

NetworkSimulator.prototype.stop = function () {
  var _this = this;
  return new Promise(function (resolve) {
    _this.sockets.forEach(function (pair) {
      if (pair.in) pair.in.destroy();
      if (pair.out) pair.out.destroy();
    });

    _this.sockets.length = 0;

    _this.server.close(function () {
      delete _this.server;
      resolve();
    })
  });
};

NetworkSimulator.prototype.startLargePayload = function () {
  if (this.log) console.log('START LARGE PAYLOAD');

  // Cork the outbound socket (to server) so that buffer accumulates.
  // Results in pings queueing up (instead of arriving at server) as if after a large payload.

  // Only corking the most recently added socket.

  var pair = this.sockets[this.sockets.length - 1];
  pair.corked = true;
  pair.out.cork();
};

NetworkSimulator.prototype.stopLargePayload = function () {
  if (this.log) console.log('STOP LARGE PAYLOAD');

  // Uncork

  this.sockets.forEach(function (pair) {
    if (!pair.corked) return;
    pair.out.uncork();
  });
};

NetworkSimulator.prototype.startNetworkSegmentation = function () {
  if (this.log) console.log('START NETWORK SEGMENTATION');

  // Completely disconnect the in/out sockets bindings.

  this.networkSegmentation = true;

  this.sockets.forEach(function (pair) {
    pair.in.removeListener('close', pair.in.onClose);
    pair.in.removeListener('data', pair.in.onData);
    pair.out.removeListener('close', pair.out.onClose);
    pair.out.removeListener('data', pair.out.onData);
  });

  this.server.close();
};

NetworkSimulator.prototype.stopNetworkSegmentation = function () {
  if (this.log) console.log('STOP NETWORK SEGMENTATION');

  this.networkSegmentation = false;

  this.sockets.forEach(function (pair) {
    pair.in.on('close', pair.in.onClose);
    pair.in.on('data', pair.in.onData);
    pair.out.on('close', pair.out.onClose);
    pair.out.on('data', pair.out.onData);
  });

  this.server.listen(this.listenPort);
};

NetworkSimulator.prototype._handleConnection = function (socket) {
  var _this = this;

  var pair = {
    in: socket,
    out: null
  }

  this.sockets.push(pair);

  if (this.log) console.log('CONNECTED IN');

  pair.out = net.connect(this.forwardToPort);

  // relay close
  pair.in.onClose = function () {
    if (_this.log) console.log('CLOSED IN');
    pair.in = null;
    if (pair.out) {
      pair.out.destroy();
      return;
    }
    _this.sockets.splice(_this.sockets.indexOf(pair), 1);
  }

  // delay relay data per latency
  pair.in.onData = function (buf) {
    if (_this.log) console.log('DATA IN:\n', buf.toString());
    setTimeout(function () {
      if (pair.out) pair.out.write(buf);
    }, _this.latency);
  }

  // relay close
  pair.out.onClose = function () {
    if (_this.log) console.log('CLOSED OUT');
    pair.out = null;
    if (pair.in) {
      pair.in.destroy();
      return;
    }
    _this.sockets.splice(_this.sockets.indexOf(pair), 1);
  }

  // delay relay data per latency
  pair.out.onData = function (buf) {
    if (_this.log) console.log('DATA OUT:\n', buf.toString());
    setTimeout(function () {
      if (pair.in) pair.in.write(buf);
    }, _this.latency);
  }

  // bind
  pair.in.on('close', pair.in.onClose);
  pair.in.on('data', pair.in.onData);
  pair.out.on('close', pair.out.onClose);
  pair.out.on('data', pair.out.onData);
};
