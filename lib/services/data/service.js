var _s = require('underscore.string')
  , traverse = require('traverse')
  , uuid = require('node-uuid')
  , async = require('async')
  , Promise = require('bluebird')
;

module.exports = DataEmbeddedService;

function DataEmbeddedService(opts) {

  var Logger;

  if (opts && opts.logger) {
    Logger = opts.logger.createLogger('DataEmbedded');
  } else {
    Logger = require('happn-logger');
    Logger.configure({logLevel: 'info'});
  }

  this.log = Logger.createLogger('DataEmbedded');
  this.log.$$TRACE('construct(%j)', opts);
}

DataEmbeddedService.prototype.pathField = "_id";

DataEmbeddedService.prototype.stop = function (options, callback) {

  if (typeof options === 'function') callback = options;

  try {
    callback();
  } catch (e) {
    callback(e);
  }
};

DataEmbeddedService.prototype.processMessage = Promise.promisify(function(message, callback){

  try{

    var _this = this;

    var doCallback = function(e, response){
      if (e) return callback(e);

      message.response = response;
      return callback(null, message);
    };

    if (message.request.action == 'get') return _this.get(message.request.path, message.request.options, doCallback);

    else if (message.request.action == 'set') {

      if (message.request.options && message.request.options.noStore) return doCallback(null, _this.formatSetData(message.request.path, message.request.data));

      return _this.upsert(message.request.path, message.request.data, message.request.options, doCallback);
    }

    else if (message.request.action == 'remove') return _this.remove(message.request.path, message.request.options, doCallback);

    else callback(null, message);

  }catch(e){
    callback(e, message);
  }
});

DataEmbeddedService.prototype.initialize = function (config, callback) {

  var _this = this;

  try {

    var Datastore = require('happn-nedb');
    _this.config = config;

    if (config.datastores && config.datastores.length > 0) {

      _this.datastores = {};
      _this.dataroutes = {};

      for (var configIndex in  _this.config.datastores) {

        var datastoreConfig = _this.config.datastores[configIndex];

        if (!datastoreConfig.name) return callback(new Error('invalid configuration, datastore config in position ' + configIndex + ' has no name'));

        _this.datastores[datastoreConfig.name] = {};

        if (configIndex == 0) _this.defaultDatastore = datastoreConfig.name;//just in case we havent set a default

        if (!datastoreConfig.settings) datastoreConfig.settings = {};

        if (!datastoreConfig.patterns) datastoreConfig.patterns = [];

        //make sure we match the special /_TAGS patterns to find the right db for a tag
        datastoreConfig.patterns.every(function (pattern) {

          if (pattern.indexOf('/') == 0) pattern = pattern.substring(1, pattern.length);

          _this.addDataStoreFilter(pattern, datastoreConfig.name);

          return true;
        });

        if (datastoreConfig.settings.dbfile) //backward compatable
          datastoreConfig.settings.filename = datastoreConfig.settings.dbfile;

        if (datastoreConfig.settings.filename) {

          //we take the first datastore with a filename and set it to default
          if (!_this.defaultDatastore) _this.defaultDatastore = datastoreConfig.name;

          datastoreConfig.settings.autoload = true;//we definately autoloading
        }

        datastoreConfig.settings.timestampData = true;

        //forces the default datastore
        if (datastoreConfig.isDefault) _this.defaultDatastore = datastoreConfig.name;

        _this.datastores[datastoreConfig.name].db = new Datastore(datastoreConfig.settings);
        _this.datastores[datastoreConfig.name].config = datastoreConfig;

      }

      //if there is no default datastore (none with a filename, nodefault in config), we take the first one and make it a default
      if (!_this.defaultDatastore) _this.defaultDatastore = _this.config.datastores[0].name;

      //the default datastore is used to store system data keypairs and the system name
      _this.addDataStoreFilter('/_SYSTEM/*', _this.defaultDatastore);

      _this.db = function (path) {

        for (var dataStoreRoute in _this.dataroutes)
          if (_this.happn.services.utils.wildcardMatch(dataStoreRoute, path)) return _this.dataroutes[dataStoreRoute].db;

        return _this.datastores[_this.defaultDatastore].db;
      }

    } else {

      if (_this.config.dbfile) _this.config.filename = _this.config.dbfile;

      if (_this.config.filename) _this.dbInstance = new Datastore({filename: _this.config.filename, autoload: true, timestampData: true});
      else _this.dbInstance = new Datastore({timestampData: true});

      _this.db = function (path) {
        return _this.dbInstance;
      };
    }

    //compact all db's for now
    if (_this.config.compactInterval) return _this.startCompacting(_this.config.compactInterval, callback);

    callback();
  } catch (e) {
    callback(e);
  }
}

DataEmbeddedService.prototype.__compacting = {};
DataEmbeddedService.prototype.startCompacting = function (dataStoreKey, interval, callback, compactionHandler) {
  try {

    if (!dataStoreKey)
      throw new Error('no interval, dataStoreKey or callback specified');

    if (typeof dataStoreKey == 'function') {
      compactionHandler = callback;
      callback = dataStoreKey;
      interval = 300000;//defaults the compaction to once every 5 minutes
      dataStoreKey = null;
    }

    if (typeof dataStoreKey == 'number') {
      compactionHandler = callback;
      callback = interval;
      interval = dataStoreKey;
      dataStoreKey = null;
    }

    if (typeof interval == 'function') {
      compactionHandler = callback;
      interval = dataStoreKey;
      callback = interval;
    }

    interval = parseInt(interval.toString());

    if (interval < 5000)
      throw new Error('interval must be at least 5000 milliseconds');

    var _this = this;

    _this.__iterateDataStores(dataStoreKey, function (key, dataStore, next) {

        if (dataStore.db.inMemoryOnly)
          return next();

        _this.__compacting[key] = dataStore;
        _this.__compacting[key].db.persistence.setAutocompactionInterval(interval);

        if (compactionHandler) {
          _this.__compacting[key].db.on('compaction.done', compactionHandler);
        }

        next();
      },
      callback);


  } catch (e) {
    callback(e);
  }
};

DataEmbeddedService.prototype.stopCompacting = function (dataStoreKey, callback) {
  var _this = this;

  _this.__iterateDataStores(dataStoreKey, function (key, dataStore, next) {
      dataStore.persistence.stopAutocompaction();
      delete _this.__compacting[key];
      next();
    },
    callback);
};

DataEmbeddedService.prototype.__compact = function (ds, callback) {

  if (ds.db.inMemoryOnly)
    return callback();

  ds.db.on('compaction.done', callback);
  ds.db.persistence.compactDatafile();
};

DataEmbeddedService.prototype.__iterateDataStores = function (dataStoreKey, operator, callback) {
  var _this = this;

  try {

    if (typeof dataStoreKey == 'function') {
      callback = operator;
      operator = dataStoreKey;
      dataStoreKey = null;
    }

    if (dataStoreKey) {

      if (!_this.datastores)
        return callback(new Error('datastore with key ' + dataStoreKey + ', specified, but multiple datastores not configured'));

      if (!_this.datastores[dataStoreKey])
        return callback(new Error('datastore with key ' + dataStoreKey + ', does not exist'));

      return operator(dataStoreKey, _this.datastores[dataStoreKey], callback);
    }

    if (_this.datastores) {
      async.eachSeries(Object.keys(_this.datastores), function (key, next) {
        operator(key, _this.datastores[key], next);
      }, callback);
    } else {
      return operator('default', {db: _this.dbInstance, config: _this.config}, callback);
    }

  } catch (e) {
    callback(e);
  }
};

DataEmbeddedService.prototype.compact = function (dataStoreKey, callback) {

  var _this = this;

  try {

    if (typeof dataStoreKey == 'function') {
      callback = dataStoreKey;
      dataStoreKey = null;
    }

    _this.__iterateDataStores(dataStoreKey,
      function (key, dataStore, next) {
        _this.__compact(dataStore, next);
      },
      callback
    );

  } catch (e) {
    callback(e);
  }
};

DataEmbeddedService.prototype.addDataStoreFilter = function (pattern, datastoreKey) {

  if (!datastoreKey) throw new Error('missing datastoreKey parameter');

  var dataStore = this.datastores[datastoreKey];

  if (!dataStore) throw new Error('no datastore with the key ' + datastoreKey + ', exists');

  var tagPattern = pattern.toString();

  if (tagPattern.indexOf('/') == 0) tagPattern = tagPattern.substring(1, tagPattern.length);

  this.dataroutes[pattern] = dataStore;
  this.dataroutes['/_TAGS/' + tagPattern] = dataStore;
};

DataEmbeddedService.prototype.removeDataStoreFilter = function (pattern) {

  var tagPattern = pattern.toString();

  if (tagPattern.indexOf('/') == 0)
    tagPattern = tagPattern.substring(1, tagPattern.length);

  delete this.dataroutes[pattern];
  delete this.dataroutes['/_TAGS/' + tagPattern];

};

DataEmbeddedService.prototype.getOneByPath = function (path, fields, callback) {

  if (!fields) fields = {};

  this.db(path).findOne({_id: path}, fields, function (e, findresult) {
    if (e) return callback(e);
    return callback(null, findresult);
  });
};

DataEmbeddedService.prototype.insertTag = function(snapshotData, tag, path, callback){

  var _this = this;

  var tagPath = '/_TAGS' + path + '/' + uuid.v4().replace(/-/g, '');

  var tagData = {
    data: snapshotData,

    // store out of actual address space
    _tag: tag,
    _id: tagPath,
    path: tagPath
  };

  this.db(path).insert(tagData, function (e, tag) {
    if (e)
      callback(e);
    else {
      callback(null, _this.transform(tag, tag._meta));
    }
  });
};

DataEmbeddedService.prototype.saveTag = function (path, tag, data, callback) {

  if (!data) {

    this.getOneByPath(path, null, function (e, found) {

      if (e) return callback(e);

      if (found) {
        data = found;
        this.insertTag(found, tag, path, callback);
      }
      else return callback(new Error('Attempt to tag something that doesn\'t exist in the first place'));

    });

  } else this.insertTag(data, tag, path, callback);
};

DataEmbeddedService.prototype.parseFields = function (fields) {

  traverse(fields).forEach(function (value) {
    if (value) {
      if (value.bsonid) this.update(value.bsonid);
      //ignore elements in arrays
      if (this.parent && Array.isArray(this.parent.node)) return;

      if (typeof this.key == 'string') {
        //ignore directives
        if (this.key.indexOf('$') == 0) return;
        //ignore _meta
        if (this.key == '_meta') return;
        //ignore _id
        if (this.key == '_id') return;
        //ignore path
        if (this.key == 'path') return;

        //look in the right place for created
        if (this.key == '_meta.created') {
          fields['created'] = value;
          return this.remove();
        }
        //look in the right place for modified
        if (this.key == '_meta.modified') {
          fields['modified'] = value;
          return this.remove();
        }
        //prepend with data.
        fields['data.' + this.key] = value;
        return this.remove();

      }
    }
  });

  return fields;
};

DataEmbeddedService.prototype.get = function (path, parameters, callback) {
  var _this = this;

  try {

    if (typeof parameters == 'function') {
      callback = parameters;
      parameters = null;
    }

    if (!parameters) parameters = {};

    if (!parameters.options) parameters.options = {};

    var dbFields = parameters.options.fields || {};
    var dbCriteria = {$and: []};

    if (parameters.options.path_only) dbFields = {_meta: 1};

    else if (parameters.options.fields) dbFields._meta = 1;

    dbFields = _this.parseFields(dbFields);


    var returnType = path.indexOf('*'); //0,1 == array -1 == single


    if (returnType == 0) dbCriteria.$and.push({'_id': {$regex: new RegExp(path.replace(/[*]/g, '.*'))}});//keys with any prefix ie. */joe/bloggs

    else if (returnType > 0) dbCriteria.$and.push({'_id': {$regex: new RegExp('^' + path.replace(/[*]/g, '.*'))}});//keys that start with something but any suffix /joe/*/bloggs/*

    else dbCriteria.$and.push({'_id': path}); //precise match


    if (parameters.criteria) {

      returnType = 1;//just an indicator so an array gets returned, so we dont have to use another variable
      dbCriteria.$and.push(_this.parseFields(parameters.criteria));

    }

    var cursor = _this.db(path).find(dbCriteria, dbFields);

    if (parameters.options.sort) cursor = cursor.sort(_this.parseFields(parameters.options.sort));

    if (parameters.options.limit) cursor = cursor.limit(parameters.options.limit);

    cursor.exec(function (e, items) {

      if (e) return callback(e);

      if (parameters.options.path_only) {
        return callback(e, {
          paths: items.map(function (itm) {
            return _this.transform(itm);
          })
        });
      }

      if (returnType == -1) {//this is a single item
        if (!items[0]) return callback(e, null);
        return callback(e, _this.transform(items[0]));
      }

      callback(null, items.map(function (item) {
        return _this.transform(item);
      }));
    });

  } catch (e) {
    callback(e);
  }
};

DataEmbeddedService.prototype.formatSetData = function (path, data) {

  if (typeof data != 'object' || data instanceof Array == true || data instanceof Date == true || data == null)
    data = {value: data};

  var setData = {
    data: data,
    _meta: {
      path: path
    }
  };

  return setData;
};

DataEmbeddedService.prototype.upsert = function (path, data, options, callback) {
  var _this = this;

  options = options ? options : {};

  if (data) delete data._meta;

  if (options.set_type == 'sibling') {
    //appends an item with a path that matches the message path - but made unique by a shortid at the end of the path
    if (!_s.endsWith(path, '/'))
      path += '/';

    path += uuid.v4().replace(/-/g, '');

  }

  var setData = _this.formatSetData(path, data);

  if (options.tag) {
    if (data != null) {
      return callback(new Error('Cannot set tag with new data.'));
    }
    setData.data = {};
    options.merge = true;
  }

  if (options.merge) {

    return _this.getOneByPath(path, null, function (e, previous) {

      if (e)
        return callback(e);

      if (!previous) return _this.__upsertInternal(path, setData, options, true, callback);

      for (var propertyName in previous.data)
        if (setData.data[propertyName] === null || setData.data[propertyName] === undefined)
          setData.data[propertyName] = previous.data[propertyName];

      setData.created = previous.created;
      setData.modified = Date.now();
      setData._id = previous._id;

      _this.__upsertInternal(path, setData, options, true, callback);

    });
  }

  _this.__upsertInternal(path, setData, options, false, callback);

};

DataEmbeddedService.prototype.transform = function (dataObj, meta) {
  var transformed = {};

  transformed.data = dataObj.data;

  if (!meta) {
    meta = {};

    if (dataObj.created)
      meta.created = dataObj.created;

    if (dataObj.modified)
      meta.modified = dataObj.modified;
  }

  transformed._meta = meta;
  transformed._meta.path = dataObj._id;
  transformed._meta._id = dataObj._id;

  if (dataObj._tag)
    transformed._meta.tag = dataObj._tag;

  return transformed;
};

DataEmbeddedService.prototype.__upsertInternal = function (path, setData, options, dataWasMerged, callback) {
  // this.log.info('XXX - __upsertInternal()');
  var _this = this;
  var setParameters = {$set: {'data': setData.data, '_id': setData._meta.path, 'path': setData._meta.path}};

  _this.db(path).update({'_id': path}, setParameters, {upsert: true}, function (err, response, created, upsert, meta) {

    if (err) {

      //data with circular references can cause callstack exceeded errors

      if (err.toString() == 'RangeError: Maximum call stack size exceeded')
        return callback(new Error('callstack exceeded: possible circular data in happn set method'));

      return callback(err);
    }

    if (dataWasMerged && !options.tag) {
      if (created) return callback(null, _this.transform(created));
      return callback(null, _this.transform(setData, meta));
    }

    // we have a prefetched object, and we want to tag it
    if (dataWasMerged && options.tag) return _this.saveTag(path, options.tag, setData, callback);

    if (!dataWasMerged && !options.tag) { // no prefetched object, and we dont need to tag - we need to fetch the object

      if (created) return callback(null, _this.transform(created));

      setData._id = path;
      setData.modified = Date.now();
      callback(null, _this.transform(setData, meta));

    }

  }.bind(_this));
};

DataEmbeddedService.prototype.remove = function (path, options, callback) {
  var criteria = {'_id': path};

  if (path.indexOf('*') > -1)
    criteria = {'_id': {$regex: new RegExp(path.replace(/[*]/g, '.*'))}};

  this.db(path).remove(criteria, {multi: true}, function (err, removed) {

    if (err) return callback(err);

    callback(null, {
      'data': {
        removed: removed
      },
      '_meta': {
        timestamp: Date.now(),
        path: path
      }
    });
  });
};
