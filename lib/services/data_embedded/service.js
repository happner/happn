var _s = require('underscore.string');
var traverse = require('traverse');
var shortid = require('shortid');

module.exports = DataEmbeddedService;

function DataEmbeddedService(opts) {
    this.log = opts.logger.createLogger('DataEmbedded');
    this.log.$$TRACE('construct(%j)', opts);
}

DataEmbeddedService.prototype.stop = function(options, done){
    var _this = this;
    try{
        done();
    }catch(e){
        done(e);
    }
}

DataEmbeddedService.prototype.initialize = function(config, done){

    var _this = this;

    try{

        var Datastore = require('happn-nedb');
        _this.config = config;
        
        if (config.datastores && config.datastores.length > 0){

            _this.datastores = {};
            _this.dataroutes = {};

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

                    _this.addDataStoreFilter(pattern, datastoreConfig.name);

                    return true;
                });

                if (datastoreConfig.settings.dbfile) //backward compatable
                    datastoreConfig.settings.filename = datastoreConfig.settings.dbfile;

                if (datastoreConfig.settings.filename){

                    //we take the first datastore with a filename and set it to default
                    if (!_this.defaultDatastore)
                        _this.defaultDatastore = datastoreConfig.name;

                    datastoreConfig.settings.autoload = true;//we definately autoloading
                }
                    

                datastoreConfig.settings.timestampData = true;

                //forces the default datastore
                if (datastoreConfig.isDefault)
                     _this.defaultDatastore = datastoreConfig.name;

                _this.datastores[datastoreConfig.name].db = new Datastore(datastoreConfig.settings);
                _this.datastores[datastoreConfig.name].config = datastoreConfig;

            }

            //if there is no default datastore (none with a filename, nodefault in config), we take the first one and make it a default
            if (!_this.defaultDatastore)
                _this.defaultDatastore = _this.config.datastores[0].name;

            //the default datastore is used to store system data keypairs and the system name
            _this.addDataStoreFilter('/_SYSTEM/*', _this.defaultDatastore);


            _this.db = function(path){
                
                for (var dataStoreRoute in _this.dataroutes){
                    if (_this.happn.utils.wildcardMatch(dataStoreRoute, path)) return _this.dataroutes[dataStoreRoute].db;
                }

                return _this.datastores[_this.defaultDatastore].db;
            }

        }else{

            if (_this.config.dbfile)
                _this.config.filename = _this.config.dbfile;

            if (_this.config.filename)
                _this.dbInstance = new Datastore({ filename:_this.config.filename, autoload:true, timestampData:true });
            else
                _this.dbInstance = new Datastore({ timestampData:true });

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
        throw new Error('missing datastoreKey parameter');

    var dataStore = _this.datastores[datastoreKey];

    if (!dataStore)
        throw new Error('no datastore with the key ' + datastoreKey + ', exists');

    var tagPattern = pattern.toString();

    if (tagPattern.indexOf('/') == 0)
        tagPattern = tagPattern.substring(1, tagPattern.length);

    _this.dataroutes[pattern] = dataStore;
    _this.dataroutes['/_TAGS/' + tagPattern] = dataStore;

}

DataEmbeddedService.prototype.removeDataStoreFilter = function(pattern){
    
    var _this = this;
    var tagPattern = pattern.toString();

    if (tagPattern.indexOf('/') == 0)
        tagPattern = tagPattern.substring(1, tagPattern.length);

    delete _this.dataroutes[pattern];
    delete _this.dataroutes['/_TAGS/' + tagPattern];

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
            _tag:tag,
            _id: '/_TAGS' + path + '/' + shortid.generate()
        }

        _this.db(path).insert(tagData, function(e, tag){

            if (e)
                callback(e);
            else{
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

DataEmbeddedService.prototype.parseFields = function(fields){

    var _this = this;
    traverse(fields).forEach(function (value) {

        if (value){

            if (value.bsonid) this.update(value.bsonid);

            //ignore elements in arrays
            if (this.parent && Array.isArray(this.parent.node)) return;

            if (typeof this.key == 'string'){

                //ignore directives
                if (this.key.indexOf('$') == 0) return;

                //ignore _meta
                if (this.key == '_meta') return;

                //ignore _id
                if (this.key == '_id') return;

                //look in the right place for created
                if (this.key == '_meta.created'){
                   fields['created'] = value;
                   return this.remove();
                }

                //look in the right place for modified
                if (this.key == '_meta.modified'){
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
}

DataEmbeddedService.prototype.get = function(path, parameters, callback){
    var _this = this;

     try{

        if (!parameters)
            parameters = {};

        if (!parameters.options)
            parameters.options = {};

        var dbFields = parameters.options.fields || {};
        var dbCriteria = {$and:[]};
        var single = true;

        if (parameters.options.path_only) {
           dbFields = {_meta:1}
        }else if (parameters.options.fields) {
           dbFields._meta = 1;
        } 

        dbFields = _this.parseFields(dbFields);

        if (path.indexOf('*') >= 0) {
            single = false;
            dbCriteria.$and.push({"_id":{ $regex: new RegExp(path.replace(/[*]/g,'.*'))}});
        }
        else {
            dbCriteria.$and.push({"_id":path});
        }

        if (parameters.criteria){
            single = false;
            dbCriteria.$and.push(_this.parseFields(parameters.criteria));
        }

        var cursor = _this.db(path).find(dbCriteria, dbFields);

        if (parameters.options.sort){
            cursor = cursor.sort(_this.parseFields(parameters.options.sort));
        }
            
        if (parameters.options.limit)
            cursor = cursor.limit(parameters.options.limit);

        cursor.exec(function(e, items){

            if (e) return callback(e);

            if (parameters.options.path_only) {
                return callback(e, {
                    paths: items.map(function(itm) {
                        return _this.transform(itm);
                    })
                });
            }

            if (single) {
                if (!items[0]) return callback(e, null);
                return callback(e, _this.transform(items[0]));
            }

            callback(null, items.map(function(item) {
                return _this.transform(item);
            }));
        });

    }catch(e){
        callback(e);
    }
}

DataEmbeddedService.prototype.formatSetData = function(path, data){

    if (typeof data != 'object' || data instanceof Array == true || data instanceof Date == true || data == null)
        data = {value:data};
       
    var setData = {
        data: data,
        _meta: {
            path: path
        },
    }

    return setData;
}

DataEmbeddedService.prototype.upsert = function(path, data, options, callback){
     var _this = this;

    options = options?options:{};

    if (data) delete data._meta;

    if (options.set_type == 'sibling'){
        //appends an item with a path that matches the message path - but made unique by a shortid at the end of the path
        if (!_s.endsWith(path, '/'))
            path += '/';

        path += shortid.generate();

    }

    var setData = _this.formatSetData(path, data);
    
    if (options.tag) {
        if (data != null) {
            return callback(new Error('Cannot set tag with new data.'));
        }
        setData.data = {};
        options.merge = true;
    }

    if (options.merge){

        return _this.getOneByPath(path, null, function(e, previous){

            if (e)
                return callback(e);

            if (!previous) return _this.upsertInternal(path, setData, options, true, callback);
            
            for (var propertyName in previous.data)
                if (setData.data[propertyName] === null || setData.data[propertyName] === undefined)
                    setData.data[propertyName] = previous.data[propertyName];

            setData.created = previous.created;
            setData.modified = Date.now();
            setData._id = previous._id;

            _this.upsertInternal(path, setData, options, true, callback);

         });

    }

    _this.upsertInternal(path, setData, options, false, callback);

}

DataEmbeddedService.prototype.transform = function(dataObj, additionalMeta){
    var transformed = {};

    transformed.data = dataObj.data;

    transformed._meta = {
        path:dataObj._id,
        tag:dataObj._tag
    }

    if (dataObj.created)
        transformed._meta.created = dataObj.created;

    if (dataObj.modified)
        transformed._meta.modified = dataObj.modified;

    if (additionalMeta){
        for (var additionalProperty in additionalMeta)
           transformed._meta[additionalProperty] = additionalMeta[additionalProperty];
    }

    return transformed;
}

DataEmbeddedService.prototype.upsertInternal =function(path, setData, options, dataWasMerged, callback){
    var _this = this;
    var setParameters = {$set: {"data":setData.data, "_id":setData._meta.path}};

    _this.db(path).update({"_id":path}, setParameters, {upsert:true}, function(err, response, created) {

        if (err) 
            return callback(err);

        if (dataWasMerged && !options.tag) {
            if (created) return callback(null, _this.transform(created)); 
            return callback(null, _this.transform(setData));
        }

        if (dataWasMerged && options.tag){ // we have a prefetched object, and we want to tag it

            return _this.saveTag(path, options.tag, setData, function(e, tagged){

                if (e)
                    return callback(e);

                return callback(null, _this.transform(tagged, tagged._meta));
            });
        }
        
        if (!dataWasMerged && !options.tag){ // no prefetched object, and we dont need to tag - we need to fetch the object

            if (created) return callback(null, _this.transform(created));

            setData._id = path;
            setData.modified = Date.now();
            callback(null, _this.transform(setData));

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
