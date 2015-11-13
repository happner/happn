var _s = require('underscore.string');
var traverse = require('traverse');
var shortid = require('shortid');

module.exports = DataEmbeddedService;

function DataEmbeddedService() {}

DataEmbeddedService.prototype.stop = function(options, done){
    var _this = this;
    try{
        //_this.db.stop();
        done();
    }catch(e){
        done(e);
    }
}

DataEmbeddedService.prototype.initialize = function(config, done){

    var _this = this;

    try{

        var Datastore = require('nedb');
        _this.config = config;
        
        if (config.datastores && config.datastores.length > 0){

            _this.datastores = {};
        
            for (var configIndex in  _this.config.datastores){

                var datastoreConfig =  _this.config.datastores[configIndex];

                if (!datastoreConfig.name)
                    return done(new Error('invalid configuration, datastore config in position ' + configIndex + ' has no name'));
                   
                _this.datastores[datastoreConfig.name] = {};

                if (configIndex == 0)
                     _this.defaultDatastore = datastoreConfig.name;//just in case we havent set a default

                if (!datastoreConfig.settings)
                    datastoreConfig.settings = {};

                if (!datastoreConfig.patterns)
                    datastoreConfig.patterns = [];

                //make sure we match the special /_TAGS patterns to find the right db for a tag
                datastoreConfig.patterns.every(function(pattern){

                    if (pattern.indexOf('/') == 0)
                        pattern = pattern.substring(1, pattern.length);

                    datastoreConfig.patterns.push('/_TAGS/' + pattern);
                    return true;
                });

                if (datastoreConfig.settings.dbfile) //backward compatable
                    datastoreConfig.settings.filename = datastoreConfig.settings.dbfile;

                if (datastoreConfig.settings.filename)
                    datastoreConfig.settings.autoload = true;//we definately autoloading

                if (datastoreConfig.isDefault)
                     _this.defaultDatastore = datastoreConfig.name;

                _this.datastores[datastoreConfig.name].db = new Datastore(datastoreConfig.settings);
                _this.datastores[datastoreConfig.name].config = datastoreConfig;



            }

            _this.db = function(path){

                for (var datastoreConfigName in _this.datastores){
                    for (var patternIndex in _this.datastores[datastoreConfigName].config.patterns){
                        if (_this.happn.utils.wildcardMatch(_this.datastores[datastoreConfigName].config.patterns[patternIndex], path)) {
                            return _this.datastores[datastoreConfigName].db;
                        }
                    }
                }

                return _this.datastores[_this.defaultDatastore].db;
            }

        }else{

            if (_this.config.dbfile)
                _this.config.filename = _this.config.dbfile;

            if (_this.config.filename)
                 _this.dbInstance = new Datastore({ filename:_this.config.filename, autoload:true });
            else
                 _this.dbInstance = new Datastore();

            _this.db = function(path){
                return _this.dbInstance;
            }
        }

        done();

    }catch(e){
        done(e);
    }
}

DataEmbeddedService.prototype.addDataStoreFilter = function(pattern, datastoreKey){

    var _this = this;

    if (!datastoreKey)
        datastoreKey = _this.defaultDatastore;

    var dataStore = _this.datastores[datastoreKey];

    if (!dataStore)
        throw new Error('no datastore with the key ' + datastoreKey + ', exists');

    dataStore.config.patterns.push(pattern);

    var tagPattern = pattern.toString();

    if (tagPattern.indexOf('/') == 0)
        tagPattern = tagPattern.substring(1, tagPattern.length);

    dataStore.config.patterns.push('/_TAGS/' + tagPattern);
}

DataEmbeddedService.prototype.removeDataStoreFilter = function(pattern, datastoreKey){
    
    var _this = this;

    if (!datastoreKey)
        datastoreKey = _this.defaultDatastore;

    var dataStore = _this.datastores[datastoreKey];

    if (!dataStore)
        return;

    var tagPattern = pattern.toString();

    if (tagPattern.indexOf('/') == 0)
        tagPattern = tagPattern.substring(1, tagPattern.length);

    for (var patternIndex in dataStore.config.patterns){
        var dataStorePattern = dataStore.config.patterns[patternIndex];
        if (dataStorePattern == pattern || dataStorePattern == tagPattern)
            dataStore.config.patterns.splice(patternIndex, 1);
    }

}

DataEmbeddedService.prototype.getOneByPath = function(path, fields, callback){
     var _this = this;

     if (!fields)
        fields = {};

     _this.db(path).findOne({ _id: path }, fields, function(e, findresult){

        if (e)
            return callback(e);

        return callback(null, findresult);

     });
}

DataEmbeddedService.prototype.saveTag = function(path, tag, data, callback){
    var _this = this;

     var insertTag = function(snapshotData){

        var tagData = {
            data:snapshotData,

            // store out of actual address space
            _meta: {
                created: Date.now(),
                tag: tag
            },
            _id: '/_TAGS' + path + '/' + shortid.generate()
        }

        _this.db(path).insert(tagData, function(e, tag){

            if (e)
                callback(e);
            else{
                //EMBEDDED DIFFERENCE

                callback(null, tag);
            }
               

        });
     }

     if (!data){

        _this.getOneByPath(path, null, function(e, found){

            if (e)
                return callback(e);

            if (found)
            {
                data = found;
                insertTag(found);
            }   
            else
                return callback('Attempt to tag something that doesn\'t exist in the first place');
        });

     }else
         insertTag(data);
}

DataEmbeddedService.prototype.parseBSON = function(criteria){

    var _this = this;

    traverse(criteria).forEach(function (value) {
        if (value && value.bsonid)
            this.update(value.bsonid);//EMBEDDED DIFFERENCE
    });


    return criteria;

}

DataEmbeddedService.prototype.get = function(path, parameters, callback){
    var _this = this;

     try{

        if (!parameters)
            parameters = {};

        if (!parameters.options)
            parameters.options = {};

        var dbFields = {};
        var dbCriteria = {$and:[]};
        var single = true;

        if (parameters.options.path_only) {
            dbFields = { _meta: 1 };
        }
        else if (parameters.options.fields) {
            dbFields = parameters.options.fields;
            dbFields._meta = 1;
        }

        if (path.indexOf('*') >= 0) {
            single = false;
            dbCriteria.$and.push({"_id":{ $regex: new RegExp(path.replace(/[*]/g,'.*'))}});
        }
        else {
            dbCriteria.$and.push({"_id":path});
        }

        if (parameters.criteria){
            single = false;
            dbCriteria.$and.push(_this.parseBSON(parameters.criteria));
        }

        var cursor = _this.db(path).find(dbCriteria, dbFields);

        if (parameters.options.sort)
            cursor = cursor.sort(parameters.options.sort);

        if (parameters.options.limit)
            cursor = cursor.limit(parameters.options.limit);

        cursor.exec(function(e, items){

            if (e) return callback(e);

            if (parameters.options.path_only) {
                items = items.map(function(itm) {
                    itm._meta.path = itm._id;
                    return itm._meta;
                });
                return callback(e, {paths: items});
            }

            if (single) {

                if (!items[0]) return callback(e, null);
                items[0]._meta.path = items[0]._id;
                delete items[0]._id;
                return callback(e, items[0]);
            }

            items = items.map(function(item) {
                item._meta.path = item._id;
                delete item._id;
                return item;
            });

            callback(null, items);
        });

    }catch(e){
        callback(e);
    }
}

DataEmbeddedService.prototype.formatSetData = function(path, data, timestamp){

    if (!timestamp)
        timestamp = Date.now();

    if (typeof data != 'object' || data instanceof Array == true || data instanceof Date == true || data == null)
        data = {value:data};
       
    var setData = {
        data: data,
        _meta: {
            // created: timestamp,
            modified: timestamp,
            path: path
        },
    }

    return setData;
}

DataEmbeddedService.prototype.upsert = function(path, data, options, callback){
     var _this = this;

    options = options?options:{};
    var timestamp = Date.now();

    if (data) delete data._meta;

    if (options.set_type == 'sibling'){
        //appends an item with a path that matches the message path - but made unique by a shortid at the end of the path
        if (!_s.endsWith(path, '/'))
            path += '/';

        path += shortid.generate();

    }

    var setData = _this.formatSetData(path, data, timestamp);
    
    if (options.tag) {
        if (data != null) {
            return callback(new Error('Cannot set tag with new data.'));
        }
        setData.data = {};
        options.merge = true;
    }

    if (options.merge){

        return _this.getOneByPath(path, null, function(e, result){

            if (e)
                return callback(e);

            if (!result)
                return _this.upsertInternal(path, setData, options, true, callback);

            setData._meta.path = result._id;

            var previous = result.data;

            for (var propertyName in previous)
                if (!setData.data[propertyName])
                    setData.data[propertyName] = previous[propertyName];
            
            _this.upsertInternal(path, setData, options, true, callback);

         });

    }

    _this.upsertInternal(path, setData, options, false, callback);

}

DataEmbeddedService.prototype.upsertInternal =function(path, setData, options, dataWasMerged, callback){
    var _this = this;
    var setParameters = {$set: {"data":setData.data, "_meta.modified":setData._meta.modified, "_id":setData._meta.path}};

    _this.db(path).update({"_id":path}, setParameters, {upsert:true}, function(err, response, created) {

        if (err) 
            return callback(err);

        if (dataWasMerged && !options.tag) {

            setData._meta.path = path;
            delete setData._id;

            return callback(null, setData); 
        }

        if (dataWasMerged && options.tag){ // we have a prefetched object, and we want to tag it
            return _this.saveTag(path, options.tag, setData, function(e, tagged){

                if (e)
                    return callback(e);

                tagged._meta.path = tagged._id;
                delete tagged._id;

                return callback(null, tagged);
            });
        }
        
        if (!dataWasMerged && !options.tag){ // no prefetched object, and we dont need to tag - we need to fetch the object

            if (created){

                _this.db(path).update({"_id":path}, {$set:{"_meta.created":setData._meta.modified}}, function(err) {

                    if (err)
                        return callback(new Error('unable to set timestamp on item created on path: ' + path, err));

                    created._meta.created = setData._meta.modified;
                    created._meta.path = created._id;
                    
                    delete created._id;
                    callback(null, created);

                });

            }
            else {

                setData._meta.path = path;
                delete setData._id;

                callback(null, setData);

            }  
        }

    }.bind(_this));
}
DataEmbeddedService.prototype.remove = function(path, options, callback){
    var _this = this;

    var criteria = {"_id":path};

    if (path.indexOf('*') > -1) 
        criteria = {"_id":{ $regex: new RegExp(path.replace(/[*]/g,'.*'))  }};
        
    _this.db(path).remove(criteria, { multi: true }, function(err, removed){

        if (err) return callback(err);

        callback(null, {
            "data": {
                removed: removed
            },
            "_meta":{
                timestamp:Date.now(),
                path: path
            }
        });
    });

}
