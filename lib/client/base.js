(function () { // begin enclosed

  var browser = false;
  var Promise;
  var Clone;
  var Logger;
  var crypto;

  var clone = function (obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  var forEach = require('lodash/forEach');
  var find = require('lodash/find');

  if (typeof window !== 'undefined' && typeof document !== 'undefined') browser = true;
  if (!browser) {

    module.exports = HappnClient;
    Promise = require('bluebird');
    Logger = require('happn-logger');

  } else {
    window.HappnClient = HappnClient;
    if (!Promise || typeof Promise.promisify !== 'function') {
      Promise = Promise || {};
      Promise.promisify = function (fn) {
        return fn
      };
    }
  }

  var Promisify = function (originalFunction, opts) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      var _this = this;

      if (opts && opts.unshift) args.unshift(opts.unshift);

      // No promisify if last passed arg is function (ie callback)

      if (typeof args[args.length - 1] == 'function') {
        return originalFunction.apply(this, args);
      }

      return new Promise(function (resolve, reject) {
        // push false callback into arguments
        args.push(function (error, result, more) {
          if (error) return reject(error);
          if (more) {
            var args = Array.prototype.slice.call(arguments);
            args.shift(); // toss undefined error
            return resolve(args); // resolve array of args passed to callback
          }
          return resolve(result);
        });
        try {
          return originalFunction.apply(_this, args);
        } catch (error) {
          return reject(error);
        }
      });
    }
  }

  function HappnClient() {
    this.initialized = false;
    this.events = {};
    this.messageEvents = {};
    this.requestEvents = {};
    this.currentEventId = 0;
    this.currentListenerId = 0;
    this.errors = [];
    this.immediateTicks = 0;
    this.clientType = 'socket';
  }

  HappnClient.create = Promisify(function (options, done) {

    if (typeof options == 'function') {
      done = options;
      options = {};
    }

    var clientInstance = new HappnClient();
    clientInstance.client(options).initialize(done);
  });

  HappnClient.prototype.client = function (options) {
    var _this = this;
    // var credentials;
    options = options || {};

    if (options.Logger && options.Logger.createLogger) {
      this.log = options.Logger.createLogger('HappnClient');
    } else if (Logger) {
      if (!Logger.configured) {
        Logger.configure(options.utils);
      }
      this.log = Logger.createLogger('HappnClient');
    } else {
      this.log = {
        $$TRACE: function () {
        },
        $$DEBUG: function () {
        },
        trace: function () {
        },
        debug: function () {
        },
        info: function (msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        warn: function (msg, obj) {
          if (obj) return console.warn('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        error: function (msg, obj) {
          if (obj) return console.error('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        fatal: function (msg, obj) {
          if (obj) return console.error('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
      }
    }

    this.log.$$TRACE('new client()');

    if (!options.config)
      options.config = {};

    if (options.config.allowSelfSignedCerts) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    if (!options.config.host)
      options.config.host = '127.0.0.1';

    if (!options.config.port)
      options.config.port = 55000;

    if (!options.config.pubsub)
      options.config.pubsub = {};

    if (!options.config.pubsub.options)
      options.config.pubsub.options = {};

    if (!options.info)
      options.info = {};

    options.info._browser = browser;

    if (options.context)
      _this.context = options.context;

    if (options.plugin) {
      for (var overrideName in options.plugin) {
        if (options.plugin.hasOwnProperty(overrideName)) {
          if (options.plugin[overrideName].bind)
            _this[overrideName] = options.plugin[overrideName].bind(_this);
          else
            _this[overrideName] = options.plugin[overrideName];
        }
      }
    }

    if (!options.config.url) {
      options.config.protocol = options.config.protocol || 'http';
      if (options.config.protocol == 'http' && parseInt(options.config.port) == 80) {
        options.config.url = options.config.protocol + '://' + options.config.host;
      }
      else if (options.config.protocol == 'https' && parseInt(options.config.port) == 443) {
        options.config.url = options.config.protocol + '://' + options.config.host;
      } else {
        options.config.url = options.config.protocol + '://' + options.config.host + ':' + options.config.port;
      }
    }

    _this.options = options;
    return _this;
  };

  HappnClient.prototype.setImmediate = function (func, mod) {
    this.immediateTicks++;
    if (this.immediateTicks % mod == 0) {
      setImmediate(func);
    } else
      func.call();
  };

  HappnClient.prototype.getScript = function (url, callback) {
    if (!browser) return callback(new Error('only for browser'));
    var script = document.createElement('script');
    script.src = url;
    var head = document.getElementsByTagName('head')[0];
    var done = false;
    // Attach handlers for all browsers
    script.onload = script.onreadystatechange = function () {
      if (!done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete')) {
        done = true;
        callback();
        script.onload = script.onreadystatechange = null;
        head.removeChild(script);
      }
    };
    head.appendChild(script);
  }

  HappnClient.prototype.getResources = function (done) {

    var _this = this;

    _this.getScript(_this.options.config.url + '/browser_crypto.js', function (e) {

      if (e) return done(e);
      crypto = new window.Crypto();

      if (typeof Primus == 'undefined')
        _this.getScript(_this.options.config.url + '/browser_primus.js', done);
      else
        done();

    });

  };

  HappnClient.prototype.initialize = Promisify(function (done) {

    var _this = this;

    if (browser) {

      return _this.getResources(function (e) {

        if (e) return done(e);

        _this.authenticate(function (e) {
          if (e) return done(e);

          _this.initialized = true;
          done(null, _this);
        });

      });

    }

    Crypto = require('happn-util-crypto');
    crypto = new Crypto();

    _this.authenticate(function (e) {
      if (e) return done(e);

      _this.initialized = true;
      done(null, _this);
    });
  });


  HappnClient.prototype.stop = Promisify(function (done) {
    this.pubsub.on('end', done);
    this.pubsub.end();
  });


  HappnClient.prototype.__connecting = false;

  HappnClient.prototype.__encryptLogin = function (parameters, publicKey) {

    return {
      encrypted: crypto.asymmetricEncrypt(publicKey, this.options.config.keyPair.privateKey, JSON.stringify(parameters)),
      publicKey: publicKey
    }
  }

  HappnClient.prototype.__decryptLogin = function (loginResult) {

    return JSON.parse(crypto.asymmetricDecrypt(loginResult.publicKey, this.options.config.keyPair.privateKey, loginResult.encrypted));

  }

  HappnClient.prototype.__encryptPayload = function (message) {

    return {
      sessionId: message.sessionId,
      encrypted: crypto.symmetricEncryptObject(message, this.session.secret)
    }
  }

  HappnClient.prototype.__decryptPayload = function (message) {

    return crypto.symmetricDecryptObject(message, this.session.secret);

  }

  HappnClient.prototype.login = Promisify(function (done) {

    var _this = this;

    var loginParameters = {
      username: this.options.config.username,
      password: this.options.config.password,
      info: this.options.info
    };

    if (this.options.config.keyPair)
      loginParameters.publicKey = this.options.config.keyPair.publicKey;

    _this.performRequest(null, 'describe', null, null, function (e, serverInfo) {

      if (e) return done(e);

      _this.serverInfo = serverInfo;

      if (_this.serverInfo.encryptPayloads && _this.clientType == 'socket') {

        if (!_this.options.config.keyPair) {
          //We generate one
          _this.options.config.keyPair = crypto.createKeyPair();
          loginParameters.publicKey = _this.options.config.keyPair.publicKey;
        }

        loginParameters = _this.__encryptLogin(loginParameters, _this.serverInfo.publicKey);
      }


      _this.performRequest(null, 'login', loginParameters, null, function (e, result) {

        if (e) return done(e);

        if (result._meta.status == 'ok') {

          delete result._meta;
          _this.session = result;

          //write our session cookie
          if (browser) {
            var cookie = (result.cookieName || 'happn_token') + '=' + _this.session.token + '; path=/;';
            if (result.cookieDomain) cookie += ' domain=' + result.cookieDomain + ';';
            document.cookie = cookie;
          }

          done();
        } else {
          done(result.payload); // TODO: make into instanceof Error
        }

      });

    });

  });

  HappnClient.prototype.authenticate = Promisify(function (done) {
    var _this = this;

    if (this.pubsub) {
      // handle_reconnection also call through here to "re-authenticate".
      // This is that happending. Don't make new soket.
      //
      // TODO: What happnes if this reconnection login fails?
      //       Who gets told?
      //       How?
      this.login(done);
      return;
    }

    this.__connecting = true;

    var getConnection = function () {
      if (browser) {
        return Primus.connect(this.options.config.url, this.options.config.pubsub.options);
      }
      else {
        Primus = require('primus'),
          Socket = Primus.createSocket({
            "transformer": this.options.config.transformer,
            "parser": this.options.config.parser,
            "manual": true
          });
        return new Socket(this.options.config.url);
      }
    }.bind(this);

    this.pubsub = getConnection();

    this.pubsub.on('open', function () {
      this.__connecting = false;
    });

    this.pubsub.on('error', function (e) {
      if (_this.__connecting) {
        // ERROR before connected,
        // ECONNREFUSED etc. out as errors on callback
        _this.__connecting = false;
        return done(e);
      }
      _this.handle_error(e);
    });

    this.eventHandlers = {};
    this.onEvent = function (eventName, eventHandler) {

      if (!eventName)
        throw new Error('event name cannot be blank or null');

      if (typeof eventHandler != 'function')
        throw new Error('event handler must be a function');

      if (!this.eventHandlers[eventName])
        this.eventHandlers[eventName] = [];

      this.eventHandlers[eventName].push(eventHandler);

      return eventName + '|' + this.eventHandlers[eventName].length - 1;

    }

    this.offEvent = function (handlerId) {
      var _this = this;
      var eventName = handlerId.split('|')[0];
      var eventIndex = parseInt(handlerId.split('|')[0]);
      _this.eventHandlers[eventName].splice(eventIndex, 1);
    }

    this.emit = function (eventName, eventData) {
      var _this = this;
      if (_this.eventHandlers[eventName]) {
        _this.eventHandlers[eventName].map(function (handler) {
          handler.call(eventData);
        });
      }
    }

    this.pubsub.on('data', this.handle_publication.bind(this));
    this.pubsub.on('reconnected', this.reconnect.bind(this));
    this.pubsub.on('end', this.handle_end.bind(this));
    this.pubsub.on('reconnect timeout', this.handle_reconnect_timeout.bind(this));
    this.pubsub.on('reconnect scheduled', this.handle_reconnect_scheduled.bind(this));

    // login is called before socket connection established...
    // seems ok (streams must be paused till open)
    this.login(done);
  });

  HappnClient.prototype.handle_end = function () {
    this.emit('connection-ended');
  }

  HappnClient.prototype.handle_reconnect_timeout = function (err, opts) {
    this.emit('reconnect-timeout', {err: err, opts: opts});
  }

  HappnClient.prototype.handle_reconnect_scheduled = function (opts) {
    this.emit('reconnect-scheduled', opts)
  }

  HappnClient.prototype.getEventId = function () {
    return this.currentEventId += 1;
  };

  HappnClient.prototype.performRequest = function (path, action, data, parameters, done) {

    if (!this.initialized && ['login', 'describe'].indexOf(action) == -1) return done('client not initialized yet.');

    if (!parameters) parameters = {};

    var eventId = this.getEventId();

    var message = {"path": path, "action": action, "eventId": eventId, "parameters": parameters, "data": data};

    if (this.session)
      message.sessionId = this.session.id;

    if (!parameters.timeout)
      parameters.timeout = 20000;

    if (['login', 'describe'].indexOf(action) == -1 && this.serverInfo.encryptPayloads)
      message = this.__encryptPayload(message);

    if (done) {//if null we are firing and forgetting

      var callbackHandler = {
        "eventId": message.eventId,
        "client": this,
        "handler": done
      };

      callbackHandler.handleResponse = function (e, response) {
        clearTimeout(this.timedout);
        delete this.client.requestEvents[this.eventId];
        return this.handler(e, response);
      }.bind(callbackHandler);

      callbackHandler.timedout = setTimeout(function () {
        delete this.client.requestEvents[this.eventId];

        var errorMessage = "api request timed out";

        if (path)
          errorMessage += " path: " + path;

        if (action)
          errorMessage += " action: " + action;

        return this.handler(new Error(errorMessage));

      }.bind(callbackHandler), parameters.timeout);

      //we add our event handler to a queue, with the embedded timeout
      this.requestEvents[eventId] = callbackHandler;
    }

    this.pubsub.write(message);
  };

  HappnClient.prototype.checkPath = function (path) {
    if (path.match(/^[a-zA-Z0-9@.//_*/-\s]+$/) == null)
      throw 'Bad path, can only contain alphanumeric characters, forward slashes, underscores @ and minus signs, and the * wildcard character ie: /this/is/an/example/of/1/with/an/_*-12hello';
  };

  HappnClient.prototype.getChannel = function (path, action) {
    this.checkPath(path);

    return '/' + action.toUpperCase() + '@' + path;
  };

  HappnClient.prototype.get = Promisify(function (path, parameters, handler) {
    if (typeof parameters == 'function') {
      handler = parameters;
      parameters = {};
    }
    this.performRequest(path, 'get', null, parameters, handler);
  });

  HappnClient.prototype.getPaths = Promisify(function (path, handler) {
    this.get(path, {options: {path_only: true}}, handler);
  });

  HappnClient.prototype.set = Promisify(function (path, data, parameters, handler) {
    if (typeof parameters == 'function') {
      handler = parameters;
      parameters = {};
    }
    this.performRequest(path, 'set', data, parameters, handler);
  });

  HappnClient.prototype.setSibling = Promisify(function (path, data, handler) {
    this.set(path, data, {set_type: 'sibling'}, handler);
  });

  HappnClient.prototype.remove = Promisify(function (path, parameters, handler) {
    //path, action, data, parameters, done
    if (typeof parameters == 'function') {
      handler = parameters;
      parameters = {};
    }
    return this.performRequest(path, 'remove', null, parameters, handler);
  });

  HappnClient.prototype.reconnect = function (options) {
    var _this = this;

    _this.authenticate(function (e) {

      if (e) return _this.handle_error(e, 3);

      Object.keys(_this.events).forEach(function (eventPath) {
        var listeners = _this.events[eventPath];
        _this._remoteOn(eventPath, listeners.length, function (e) {
          if (e) _this.handle_error(e, 3);
        });
      });

      _this.emit('reconnect-successful', options)
    });
  }

  HappnClient.prototype.handle_error = function (err, severity) {

    if (!severity)
      severity = 1;

    if (this.errors.length >= 100)
      this.errors.splice(err, this.errors.length - 1, 1)
    else
      this.errors.push(err);

    this.log.error('unhandled error', err);

  };

  HappnClient.prototype.handle_publication = function (message) {

    if (message.encrypted && message._meta && message._meta.type == 'login')
      message = this.__decryptLogin(message);

    if (message.encrypted) message = this.__decryptPayload(message.encrypted);

    if (message._meta && message._meta.type == 'system')
      return this.__handleSystemMessage(message);

    if (message._meta && message._meta.type == 'data')
      return this.handle_data(message._meta.channel, message);

    if (Array.isArray(message))
      this.handle_response_array(null, message, message.pop());


    else if (message._meta.status == 'error') {

      var error = message._meta.error;

      var e = new Error();

      e.name = error.name || error.message || error;

      Object.keys(error).forEach(function (key) {
        if (!e[key])
          e[key] = error[key];
      });

      this.handle_response(e, message);

    }

    else {

      if (message.data === null) {
        //we have returned null data
        message._meta.nullData = true;
        message.data = {};
      }

      var decoded = message.data;
      decoded._meta = message._meta;
      this.handle_response(null, decoded);

    }

  };

  HappnClient.prototype.handle_response_array = function (e, response, meta) {

    var responseHandler = this.requestEvents[meta.eventId];

    if (responseHandler)
      responseHandler.handleResponse(e, response);

  };

  HappnClient.prototype.handle_response = function (e, response) {

    var responseHandler = this.requestEvents[response._meta.eventId];

    if (responseHandler) {

      if (response._meta.nullData)
        return responseHandler.handleResponse(e, null);

      responseHandler.handleResponse(e, response);
    }


  };

  HappnClient.prototype.handle_message = function (message) {

    if (this.messageEvents[message.messageType] && this.messageEvents[message.messageType].length > 0) {
      this.messageEvents[message.messageType].map(function (delegate, index, arr) {
        delegate.handler.call(this, message);
      });
    }
  };

  HappnClient.prototype.delegate_handover = function (message, delegate) {

    var _this = this;

    delegate.runcount++;

    if (delegate.count > 0 && delegate.count == delegate.runcount) {
      return _this._offListener(delegate.id, function (e) {
        if (e)
          return _this.handle_error(e);

        delegate.handler.call(_this, message.data, message._meta);
      });
    }

    delegate.handler.call(_this, message.data, message._meta);
  }

  HappnClient.prototype.handle_data = function (path, message) {

    var _this = this;

    if (_this.events[path]) {

      if (_this.events[path].length == 1) {
        //only one delegate - no cloning necessary
        return _this.delegate_handover(message, _this.events[path][0]);
      }

      if (_this.events[path].length > 1) {
        var serializedMessage = JSON.stringify(message);

        _this.events[path].map(function (delegate) {
          _this.delegate_handover(JSON.parse(serializedMessage), delegate);
        });
      }
    }
    ;
  };

  HappnClient.prototype.__systemMessageHandlers = [];

  HappnClient.prototype.__handleSystemMessage = function (message) {

    this.__systemMessageHandlers.every(function (messageHandler) {
      return messageHandler.apply(messageHandler, [message.eventKey, message.data]);
    });
  }

  HappnClient.prototype.offSystemMessage = function (index) {
    this.__systemMessageHandlers.splice(index, 1);
  };

  HappnClient.prototype.onSystemMessage = function (handler) {
    this.__systemMessageHandlers.push(handler);
    return this.__systemMessageHandlers.length - 1;
  };

  HappnClient.prototype._remoteOn = function (path, refCount, done) {
    this.performRequest(path, 'on', this.session, {"refCount": refCount}, done);
  }

  HappnClient.prototype.on = Promisify(function (path, parameters, handler, done) {

    var _this = this;

    if (typeof parameters == 'function') {
      done = handler;
      handler = parameters;
      parameters = {};
    }

    if (!parameters) parameters = {};
    if (!parameters.event_type) parameters.event_type = 'all';
    if (!parameters.count) parameters.count = 0;

    path = _this.getChannel(path, parameters.event_type);

    var listenerId = _this.currentListenerId++;

    _this._remoteOn(path, listenerId, function (e, response) {

      if (e)
        return done(e);

      if (response.status == 'error')
        return done(response.payload);

      if (!_this.events[path])
        _this.events[path] = [];

      var listener = {handler: handler, count: parameters.count, id: listenerId, runcount: 0};
      _this.events[path].push(listener);

      done(null, listenerId);
    });
  });

  HappnClient.prototype.onAll = Promisify(function (handler, done) {
    this.on('*', null, handler, done);
  });

  HappnClient.prototype._remoteOff = function (channel, refCount, done) {

    this.performRequest(channel, 'off', this.session, {"refCount": refCount}, function (e, response) {

      if (e)
        return done(e);

      if (response.status == 'error')
        return done(response.payload);

      done();
    });
  };

  HappnClient.prototype._offListener = function (listenerId, done) {
    var _this = this;

    forEach(_this.events, function (listeners, channel) {

      if (!listeners.length)
        return true;

      var listener = find(listeners, {id: listenerId});
      if (!listener) return true;

      _this._remoteOff(channel, 1, function (e) {
        if (e)
          return done(e);
        listeners.splice(listeners.indexOf(listener), 1);
        done();
      });
      return false;
    });
  };

  HappnClient.prototype._offPath = function (path, done) {
    var _this = this;

    var listenersFound = false;
    for (var channel in _this.events) {

      var channelParts = channel.split('@');
      var channelPath = channelParts.slice(1, channelParts.length).join('@');

      if (channelPath == path) {
        listenersFound = true;
        return _this._remoteOff(channel, _this.events[channel].length, function (e) {

          if (e)
            return done(e);

          delete _this.events[channel];
          done();
        });
      }
    }

    if (!listenersFound)
      done();
  }

  HappnClient.prototype.offAll = Promisify(function (done) {
    var _this = this;

    return _this._remoteOff('*', 0, function (e) {
      if (e)
        return done(e);

      _this.events = {};
      done();
    });
  });

  HappnClient.prototype.off = Promisify(function (listenerRef, done) {

    if (listenerRef == null || listenerRef == undefined)
      return done(new Error('listenerRef cannot be null'));

    if (typeof listenerRef == "number")
      return this._offListener(listenerRef, done);

    return this._offPath(listenerRef, done);
  });

  HappnClient.prototype.disconnect = Promisify(function (done) {

    try {

      if (this.pubsub && this.initialized) {

        var _this = this;

        _this.offAll(function (e) {

          if (e)
            console.warn('failed ending subscriptions on disconnect', e);

          _this.pubsub.removeAllListeners('destroy');

          _this.pubsub.on('destroy', function () {

            _this.session = null;
            _this.initialized = false;

            done();
          });

          _this.pubsub.destroy();//we stop reconnecting

        });

      } else done();

    } catch (e) {
      done(e);
    }

  });


})(); // end enclosed

