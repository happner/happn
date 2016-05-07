var async = require('async'),
    connect = require('connect'),
    cookies = require('connect-cookies'),
    utils = require('./utils'),
    serveStatic = require('serve-static'),
    shortid = require('shortid'),
    Logger = require('happn-logger'),
    transport = require('./transport'),
    Crypto = require('happn-util-crypto'),
    crypto = new Crypto()
    ;

module.exports = {
    initialize: function (config, done) {
        console.warn('use of initialize when creating happn service is deprecated. use happn.service.create');
        return this.create(config, done);
    },
    create: utils.promisify(function (config, done) {
        var _this = this;

        if (typeof config == 'function') {
            done = config;
            config = {};
        }

        if (!config.utils) {
            config.utils = {
                logLevel: 'info'
            }
        }

        if (!config.utils.Logger && !Logger.configured) {
            Logger.configure(config.utils);
        }

        var log = (config.utils.Logger || Logger).createLogger('HappnServer');
        log.context = config.name;

        var happn = {
            services: {},
            config: config,
            log: log,
            connections: {}
        };

        _this.__happn = happn;

        var app = connect();

        app.use(serveStatic(__dirname + '/public'));
        var bodyParser = require('body-parser');
        app.use(bodyParser.json());
        app.use(cookies());

        var loadMiddleware = function (middleware_name) {
            log.$$TRACE('loadMiddleware( ' + middleware_name);

            var middleware = require('./middleware/' + middleware_name);

            middleware.happn = happn;
            app.use(middleware.process.bind(middleware));

            if (middleware['process_error'])
                app.use(middleware.process_error.bind(middleware));

            if (middleware['initialize']) {
                if (config.middleware) middleware.initialize(config.middleware[middleware_name]);
                else middleware.initialize();
            }
        };

        crypto.attacheMiddleware(app, '/browser_crypto.js');

        loadMiddleware('system');
        loadMiddleware('client');
        loadMiddleware('security');

        happn.utils = utils;
        happn.connect = app;

        _this.__initialized = false;

        transport.createServer(config.transport, app, log, function (e, server) {

            if (e) return done(e);

            happn.server = server;

            Object.defineProperty(happn.server, 'listening', {
                get: function () {
                    return _this.__happn.__listening;
                },
                enumerable: 'true'
            });

            happn.server.on('connection', function (conn) {
                var key = conn.remoteAddress + ':' + conn.remotePort;
                happn.connections[key] = conn;
                conn.on('close', function () {
                    delete happn.connections[key];
                });
            });

            happn.server.on('error', function (e) {
                log.warn('server error', e);
            });

            happn.server.on('close', function (msg) {
                if (happn.__info)
                    log.info('released ' + happn.__info.address + ':' + happn.__info.port);
                else
                    log.info('released, no info');
            })

            require('./services').initialize(config, happn, log, function (e) {

                if (e) {
                    log.fatal('Failed to initialize services', e);
                    return done(e);
                }

                //how we collect stats from the various services and return them as a json object
                happn.stats = function (opts) {

                    var stats = {};

                    if (!opts)
                        opts = {};

                    for (var serviceName in happn.services) {
                        stats[serviceName] = {};

                        if (happn.services[serviceName].stats)
                            stats[serviceName] = happn.services[serviceName].stats(opts[serviceName]);
                    }

                    return stats;

                }

                happn.dropConnections = function(){
                    //drop all connections
                    for (var key in this.connections) {
                        log.$$TRACE('killing connection', key);
                        happn.connections[key].destroy();
                    }

                    log.$$TRACE('killed connections');
                }.bind(happn);

                happn.stop = utils.promisify(function (options, stopCB) {

                    log.$$DEBUG('stopping happn');

                    if (typeof options === 'function') {
                        stopCB = options;
                        options = {};
                    }

                    if (options.kill && !options.wait)
                        options.wait = 10000;

                    var kill = function () {
                        process.exit(options.exitCode || 1);
                    }

                    if (options.kill) {
                        timeout = setTimeout(function () {
                            log.error("failed to stop happn, force true");
                            kill();
                        }, options.wait);
                    }

                    async.eachSeries(Object.keys(happn.services),
                        function (serviceName, stopServiceCB) {
                            var serviceInstance = happn.services[serviceName];

                            if (serviceInstance.stop) {
                                serviceInstance.stop(options, stopServiceCB);
                            }
                            else
                                stopServiceCB();

                        },
                        function (e) {

                            if (e)
                                return stopCB(e); // not stopping network

                            //drop all connections
                            happn.dropConnections();
                            log.$$DEBUG('stopped services');

                            stopCB();
                        }.bind(this)
                    );
                });

                _this.__config = config;
                _this.__initialized = true;

                happn.__listening = false;
                happn.__erroredOnStart = false;
                happn.__listeningOn = false;
                happn.__errorOn = false;

                Object.defineProperty(happn, '__factory', {
                    enumerable: false,
                    configurable: false,
                    writable: false,
                    value: _this
                });

                happn.listen = function (host, port, callback) {

                    if (this.__listening) return callback(new Error('already listening'));
                    if (!this.__factory.__initialized) return done(new Error('main happn service not initialized'));

                    if (typeof host == 'function') {
                        callback = host;
                        host = null;
                        port = null;
                    }

                    if (typeof port == 'function') {
                        callback = port;
                        port = null;
                    }

                    // preserve zero as valid port number
                    port = port !== 'undefined' ? port : this.__defaultPort;

                    //nulls aren't provided for in the above
                    if (port == null) port = this.__defaultPort;

                    //default host is local/any
                    host = host | this.__defaultHost;

                    this.__done = callback;

                    if (!this.__errorOn) {
                        this.server.on('error', function (e) {

                            this._lastError = e;
                            this.log.warn('http server error', e);

                            // Error before listening achieved
                            //
                            // eg. EADDRINUSE
                            if (this.__done) {
                                this.__done(e, this);
                                this.__done == null;//we only want this to be called once per call to listen
                            }

                        }.bind(this));
                        _this.__errorOn = true;
                    }

                    if (!this.__listeningOn) {
                        this.server.on('listening', function () {

                            this.__info = this.server.address();
                            this.__listening = true;

                            this.log.info('listening at ' + this.__info.address + ':' + this.__info.port);
                            this.log.info('happn version ' + require('../package.json').version);

                            if (this.__done) {
                                this.__done(null, this); // <--- good, created a happn
                                this.__done == null;//we only want this to be called once per call to listen
                            }

                        }.bind(this));
                        this.__listeningOn = true;
                    }

                    this.log.$$TRACE('listen()');
                    this.server.listen(port, host);

                }.bind(happn);

                if (config.port == undefined || config.port == null)
                    config.port = 55000;

                _this.__happn.__defaultHost = config.host == null ? '0.0.0.0' : config.host;
                _this.__happn.__defaultPort = config.port;

                if (!config.deferListen)
                    _this.__happn.listen(done);
                else {
                    done(null, _this.__happn);
                }

            });

        });

    })
}
