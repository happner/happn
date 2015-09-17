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
    
        if (!config.db)
            config.db = 'happn';

         _this.config = config;

        if (_this.config.dbfile)
             _this.db = new Datastore({ filename: _this.config.dbfile, autoload:true });
        else
             _this.db = new Datastore();

         done();

        //_this.db.ensureIndex({ /* unique:true, */ fieldName:'_meta.path'}, done);

    }catch(e){
        done(e);
    }
}

DataEmbeddedService.prototype.getOneByPath = function(path, fields, callback){
     var _this = this;

     if (!fields)
        fields = {};

     _this.db.findOne({ _id: path }, fields, function(e, findresult){

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

        _this.db.insert(tagData, function(e, tag){

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

            // TODO: the fields are nested in .data

            dbFields = parameters.options.fields;
            dbFields._meta = 1;


        }

        if (path.indexOf('*') >= 1) {
            single = false;
            dbCriteria.$and.push({"_id":{ $regex: new RegExp('^' + path.replace('*',''))}});
        }
        else {
            dbCriteria.$and.push({"_id":path});
        }

        if (parameters.criteria){
            single = false;
            dbCriteria.$and.push(_this.parseBSON(parameters.criteria));
        }

        var cursor = _this.db.find(dbCriteria, dbFields);

        if (parameters.options.sort)
            cursor = cursor.sort(parameters.options.sort);

        if (parameters.options.limit)
            cursor = cursor.limit(parameters.options.limit);

        cursor.exec(function(e, items){

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

            callback(e, items);
        });

    }catch(e){
        callback(e);
    }
}

DataEmbeddedService.prototype.formatSetData = function(path, data, timestamp){

    if (!timestamp)
        timestamp = Date.now();

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

     //console.log('SETTING DATA ', setParameters);

    _this.db.update({"_id":path}, setParameters, {upsert:true}, function(err, response, created) {

        if (err) 
            return callback(err);

        //console.log('UPSERT INTERNAL', response, created);

        if (dataWasMerged && !options.tag) {
            // setData._store.path = setData.path; // prevent missing path on publish of merge
            return callback(null, setData); //this is because we already have the path and id
        }

        // forcing merge with tag
        // if (!dataWasMerged && options.tag){ // we dont have a prefetched object, but we want to tag
        //     _this.saveTag(path, options.tag, null, function(e, tagged){

        //         if (e)
        //             return callback(e);

        //         return callback(null, tagged);
        //     });
        // }

        if (dataWasMerged && options.tag){ // we have a prefetched object, and we want to tag it
            return _this.saveTag(path, options.tag, setData, function(e, tagged){

                if (e)
                    return callback(e);

                return callback(null, tagged);
            });
        }
        
        if (!dataWasMerged && !options.tag){ // no prefetched object, and we dont need to tag - we need to fetch the object

            if (created){

                _this.db.update({"_id":path}, {$set:{"_meta.created":setData._meta.modified}}, function(err) {

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
            //console.log('UPDATED', setData);
            
            
            /*
            _this.getOneByPath(path, {_id:1}, function(e, fetchedResponse){

                if (e)
                    return callback(e);

                setData._meta.id = fetchedResponse._id;

                if(fetchedResponse.created)
                    setData.created = fetchedResponse.created;

                callback(null, setData);

            });
            */
        }

    }.bind(_this));
}
DataEmbeddedService.prototype.remove = function(path, options, callback){
    var _this = this;


    var criteria = {"_id":path};

    if (path.indexOf('*') > -1) {
        criteria = {"_id":{ $regex: new RegExp('^' + path.replace('*', '')) }};
    }

    _this.db.remove(criteria, { multi: true }, function(err, removed){

        if (err) return callback(err);

        callback(null, {
            "data": {
                removed: removed
            },
            _id: {
                path: path
            }
        });
    });

}
