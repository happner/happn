var Promise = require('bluebird');

module.exports = {

  clientType: 'eventemitter',
  nonDeferred: 0,

  setImmediate: function (func, deferOn) {
    this.nonDeferred++;
    if (this.nonDeferred == deferOn) {
      this.nonDeferred = 0;
      setImmediate(func);
    } else
      func.call();
  },

  initialize: Promise.promisify(function (callback) {
    try {

      this.dataService = this.context.services.data;
      this.securityService = this.context.services.security.safe();
      this.pubsub = this.context.services.pubsub;
      this.systemService = this.context.services.system;

      var _this = this;

      if (!_this.options.config.deferSetImmediate) {
        _this.setImmediate = setImmediate;
        _this.options.config.deferSetImmediate = 0;
      }

      if (_this.context.config.secure && !_this.options.secure) {
        return callback(_this.securityService.AccessDeniedError('attempt to log on to a secure server'));
      }

      if (!_this.options.secure) {

        _this.authorizeRequest = function (message, handler, callback) {
          callback();
        };

        _this.__login = function (message, data, handler) {
          _this.session = _this.pubsub.connectLocal(_this.handle_publication.bind(_this), _this.securityService.generateEmptySession());
          return _this.pubsub.handleDataResponseLocal(null, message, _this.session, handler, _this);
        };
      }

      _this.authenticate(function (e) {

        if (e) return callback(e);

        _this.initialized = true;
        callback(null, _this);
      });

    } catch (e) {
      callback(e);
    }
  }),

  authenticate: Promise.promisify(function (callback) {

    this.__connecting = true;
    this.login(function (e) {
      this.__connecting = false;
      callback(e);
    });
  }),

  validateRequest: function (path, action, data, parameters, handler) {
    // this.context.log.info('XXX - validateRequest()');

    if (['login', 'set', 'get', 'remove', 'describe'].indexOf(action) == -1) {
      var error = new Error('invalid action: ' + action);

      if (handler)
        return handler(error);
      else
        return this.handle_error(error);
    }
  },

  authorizeRequest: function (message, handler, callback) {
    // this.context.log.info('XXX - authorizeRequest()');

    if (this.pubsub.trusted[this.session.id] == undefined) return this.pubsub.handleDataResponseLocal(this.securityService.AccessDeniedError('unauthorized'), message, null, handler, this);

    var _this = this;
    _this.securityService.authorize(_this.session, message.path, message.action, function (e, allowed) {

      if (e) return _this.pubsub.handleDataResponseLocal(e, message, null, handler, _this);

      if (!allowed) return _this.pubsub.handleDataResponseLocal(_this.securityService.AccessDeniedError('unauthorized'), message, null, handler, _this);

      callback();

    });
  },

  __login: function (message, data, handler) {
    var _this = this;

    return _this.securityService.login(data, function (e, session) {

      if (e) return _this.pubsub.handleDataResponseLocal(e, message, null, handler, _this);

      _this.session = _this.pubsub.connectLocal(_this.handle_publication.bind(_this), session);

      return _this.pubsub.handleDataResponseLocal(null, message, _this.session, handler, _this);

    });
  },

  performRequest: function (path, action, data, options, handler) {
    // this.context.log.info('XXX - performRequest()');

    if (!options) options = {};

    this.validateRequest(path, action, data, options, handler);

    var message = {'path': path, 'action': action, 'eventId': this.getEventId(), 'options': options};

    if (action == 'login') {
      return this.__login(message, data, handler);
    }

    if (action == 'describe') {
      var serviceDescription = this.systemService.getDescription();
      return this.pubsub.handleDataResponseLocal(null, message, {data: serviceDescription}, handler, this);
    }

    var _this = this;

    this.authorizeRequest(message, handler, function () {
      // _this.context.log.info('XXX - request authorized');

      if (action == 'set') {

        if (options.noStore) {
          return _this.pubsub.handleDataResponseLocal(null, message, _this.dataService.formatSetData(path, data), handler, _this);
        }

        _this.dataService.upsert(path, data, options, function (e, response) {
          return _this.pubsub.handleDataResponseLocal(e, message, response, handler, _this);
        });

      } else if (action == 'get') {

        _this.dataService.get(path, options, function (e, response) {
          _this.pubsub.handleDataResponseLocal(e, message, response, handler, _this);
        });

      } else if (action == 'remove') {

        _this.dataService.remove(path, options, function (e, response) {
          return _this.pubsub.handleDataResponseLocal(e, message, response, handler, _this);
        });
      }
    });
  },

  disconnect: Promise.promisify(function (callback) {

    var _this = this;
    _this.offAll(function (e) {

      if (e)
        console.warn('failed ending subscriptions on disconnect', e);

      _this.pubsub.disconnect(_this);

      _this.initialized = false;
      _this.session = null;

      callback();

    });
  }),

  set: Promise.promisify(function (path, data, parameters, handler) {
    // this.context.log.info('XXX - set()');
    var _this = this;
    if (typeof parameters == 'function') {
      handler = parameters;
      parameters = {};
    }
    _this.setImmediate(function () {
      _this.setInternal(path, data, parameters, handler);
    }, _this.options.config.deferSetImmediate);
  }),
  setInternal: function (path, data, parameters, handler) {
    // this.context.log.info('XXX - setInternal()');
    this.performRequest(path, 'set', data, parameters, handler);
  },
  _remoteOff: function (channel, refCount, callback) {
    try {
      this.pubsub.removeListener(this.session.index, channel, {'refCount': refCount});
      callback();
    } catch (e) {
      callback(e);
    }
  },

  offAll: Promise.promisify(function (callback) {
    try {

      if (!this.session) throw new Error('attempt to unsubscribe when session does not exist');

      this.pubsub.removeListener(this.session.index, '*');
      this.events = {};

      callback();
    } catch (e) {
      callback(e);
    }
  }),

  on: Promise.promisify(function (path, parameters, handler, callback) {

    if (typeof parameters == 'function') {
      callback = handler;
      handler = parameters;
      parameters = {};
    }

    if (!parameters) parameters = {};
    if (!parameters.event_type) parameters.event_type = 'all';
    if (!parameters.count) parameters.count = 0;

    var _this = this;

    _this.authorizeRequest({path: path, action: 'on'}, callback, function () {

      var listenerId = _this.currentListenerId++;

      try {

        var channel = _this.getChannel(path, parameters.event_type);
        _this.pubsub.addListener(channel, _this.session.index, {refCount: 1});

        if (!_this.events[channel])
          _this.events[channel] = [];

        _this.events[channel].push({handler: handler, count: parameters.count, id: listenerId, runcount: 0});

        if (parameters.initialCallback || parameters.initialEmit) {

          _this.dataService.get(path, {sort: {'modified': 1}}, function (e, initialItems) {

            if (e) return callback(e);

            if (parameters.initialCallback) {
              callback(null, listenerId, _this.pubsub.formatReturnItems(initialItems));
            }
            else {
              callback(null, listenerId);
              initialItems.map(function (item) {
                item._meta.channel = channel;
                item._meta.action = channel;
                item._meta.type = 'data';
                item._meta.eventId = listenerId;
                item._meta.status = 'ok';
                item._meta.published = false;
                handler(item.data, item._meta);
              });
            }
          });
        } else callback(null, listenerId);

      } catch (e) {
        callback(e);
      }
    });
  })
}
