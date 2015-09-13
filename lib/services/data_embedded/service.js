var _s = require('underscore.string');

// var utc = require('moment').utc;
// > {native: Date.now(), utc: moment.utc().valueOf()}
// { native: 1441991954847, utc: 1441991954848 }

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

        _this.db.ensureIndex({unique:true, fieldName:'path'}, done);

    }catch(e){
        done(e);
    }
}

DataEmbeddedService.prototype.getOneByPath = function(path, fields, callback){
     var _this = this;
     ////////////////////////console.log('in getOneByPath');
     ////////////////////////console.log(_this.db);

     if (!fields)
        fields = {};

     _this.db.findOne({path:path}, fields, function(e, findresult){

        if (e)
            return callback(e);

        //////////////console.log('got one by path');
        //////////////console.log(findresult);

        return callback(null, findresult);

     });
}

DataEmbeddedService.prototype.saveTag = function(path, tag, data, callback){
    var _this = this;

     ////////////////////////console.log('doing tag insert');
     ////////////////////////console.log(path);
     ////////////////////////console.log(tag);


     var insertTag = function(snapshotData){

        ////////////////////console.log('tag inserting...');
        

        var tagData = {
            snapshot:snapshotData,
            // store out of actual address space
            path: '_TAGS' + path + '/' + shortid.generate(),
            _store: {
            }
        }

        ////////////////////console.log(tagData);

        _this.db.insert(tagData, function(e, tag){

            ////////////console.log('tag inserted');
            ////////////console.log(e);
            ////////////console.log(tag);

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
                //////////////////////console.log('about to tag insert...');
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
    ////////////////////////console.log('traversing criteria');
    ////////////////////////console.log(criteria);

    traverse(criteria).forEach(function (value) {
        if (value && value.bsonid)
            this.update(value.bsonid);//EMBEDDED DIFFERENCE
    });

    ////////////////////////console.log('done traversing criteria');
    ////////////////////////console.log(criteria);

    return criteria;

}

DataEmbeddedService.prototype.get = function(path, parameters, callback){
    var _this = this;

     try{

        if (!parameters)
            parameters = {};

        if (!parameters.options)
            parameters.options = {};

         if (!parameters.criteria)
            parameters.criteria = {};

        var dbFields = {};
        var dbCriteria = {$and:[]};
        var single = true;

        if (parameters.options.path_only) {

            dbFields = { "path": 1 };

        }
        
        else if (parameters.options.fields) {

            // TODO: the fields are nested in .data

            dbFields = parameters.options.fields;

        }

        // console.log('TODO: child_id');

        // if (parameters.options.child_id){

        //     dbCriteria.$and.push({"path":path});
        //     dbCriteria.$and.push({"data._id":parameters.options.child_id});
           
        //     dbFields = {_id: 0, 'data.$': 1};

        // }

        // else 

        if (path.indexOf('*') >= 1) {
            single = false;
            dbCriteria.$and.push({"path":{ $regex: new RegExp('^' + path.replace('*',''))}});
        }

        else {

            dbCriteria.$and.push({"path":path});
        }

        if (parameters.criteria){
            dbCriteria.$and.push(_this.parseBSON(parameters.criteria));
        }

        //console.log('about to find');
        //console.log([dbCriteria, dbFields]);

        var cursor = _this.db.find(dbCriteria, dbFields);

        if (parameters.options.sort)
            cursor = cursor.sort(parameters.options.sort);

        if (parameters.options.limit)
            cursor = cursor.limit(parameters.options.limit);

        cursor.exec(function(e, items){

            if (parameters.options.path_only) {
                return callback(e, {paths: items});
            }

            if (single) {
                items[0]._store.path = items[0].path;
                items[0]._store.id = items[0]._id;
                delete items[0].path;
                delete items[0]._id;
                return callback(e, items[0]);
            }

            items = items.map(function(item) {
                var path, id;
                item._store.path = item.path;
                item._store.id = item._id;
                delete item.path;
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
        path: path,
        data: data,
        _store: {
            // created: timestamp,
            modified: timestamp
        },
    }

    return setData;
}

DataEmbeddedService.prototype.upsert = function(path, data, options, callback){
     var _this = this;

    options = options?options:{};
    var timestamp = Date.now();

    if (options.set_type == 'child'){
        //adds a child to a collection that sits at the given path
        var posted = {data:data, _id: shortid.generate(), modified:timestamp};

        return _this.db.update({path:path}, {$push: {data:posted}}, {upsert:true}, function(err, updatedCount) {

           if (!err)
            callback(err, posted);
           else
            callback(err);
        });

    }else if (options.set_type == 'sibling'){
        //appends an item with a path that matches the message path - but made unique by a shortid at the end of the path
        if (!_s.endsWith(path, '/'))
            path += '/';

        path += shortid.generate();

    }

    // Quick hack to get tags working... 
    // force merge with no new data.. 
    // it is only the case of merge = true that actually save the original data to the tag
    // all other combinations only saved the new data and didn't include the original (to be tagged data)
    if (options.tag) {
        if (data != null) {
            return callback(new Error('Cannot set tag with new data.'));
        }
        data = {};
        options.merge = true;
    }

    var setData = _this.formatSetData(path, data, timestamp);

    if (options.tag) { 
        setData.tag = options.tag 
    }

    if (options.merge){

        ////console.log('MERGING, GETTING ONE BY PATH');
         _this.getOneByPath(path, null, function(e, result){

            ////console.log('got one by path');
            ////console.log(e);
            ////console.log(result);

            if (e)
                return callback(e);

            if (!result)
                return _this.upsertInternal(path, setData, options, true, callback);

            var previous = result.data;
            
            ////////////////////////console.log('PREVIOUS DATA');
            ////////////////////////console.log(previous);

            for (var propertyName in previous)
                if (!setData.data[propertyName])
                    setData.data[propertyName] = previous[propertyName];
            
            _this.upsertInternal(path, setData, options, true, callback);

         });

    }else {

        _this.upsertInternal(path, setData, options, false, callback);

    }

}

DataEmbeddedService.prototype.upsertInternal =function(path, setData, options, dataWasMerged, callback){
    var _this = this;

    var setParameters = {$set: setData};

    _this.db.update({"path":path}, setParameters, {upsert:true}, function(err, response) {

        //////////////console.log('upsert response');
        //////////////console.log(response);
        //////////////console.log(setParameters);

        if (err) 
            return callback(err);


        if (dataWasMerged && !options.tag) {
            setData._store.path = setData.path; // prevent missing path on publish of merge
            return callback(null, setData); //this is because we already have the path and id
        }

        if (!dataWasMerged && options.tag){ // we dont have a prefetched object, but we want to tag
            _this.saveTag(path, options.tag, null, function(e, tagged){

                if (e)
                    return callback(e);

                return callback(null, tagged);
            });
        }

        if (dataWasMerged && options.tag){ // we have a prefetched object, and we want to tag it
            _this.saveTag(path, options.tag, setData, function(e, tagged){

                if (e)
                    return callback(e);

                return callback(null, tagged);
            });
        }
        
        if (!dataWasMerged && !options.tag){ // no prefetched object, and we dont need to tag - we need to fetch the object

            ///// setData.path = path; // already in there
            setData._store.path = path;

            if (options.excludeId){
                 callback(null, setData);
            }
            else
                _this.getOneByPath(path, {_id:1}, function(e, fetchedResponse){

                    if (!e){
                        setData._store.id = fetchedResponse._id;

                        if(fetchedResponse.created)
                            setData.created = fetchedResponse.created;

                        callback(null, setData);
                    }
                    else
                        callback(e);

                });
        }


    }.bind(_this));
}
DataEmbeddedService.prototype.remove = function(path, options, callback){
    var _this = this;

    // if (options && options.child_id){
          
    //      _this.db.update({path:path}, { $pull: { "data": {'_id':options.child_id}}}, function(err, updated){
    //         callback(err, {data:options.child_id, removed:updated});
    //      });     

    // }else{

        var criteria = {"path":path};

        if (path.indexOf('*') > -1) {
            criteria = {"path":{ $regex: new RegExp('^' + path.replace('*', '')) }};
        }
       
        //////////////////////console.log('IN DELETE, DATA SERVICE');
        //////////////////////console.log(criteria);

        _this.db.remove(criteria, { multi: true }, function(err, removed, more){

            //////////////////////console.log('DONE DELETE, DATA SERVICE');
            //////////////////////console.log([err,removed]);
            callback(err, {
                "data": {
                    removed: removed
                },
                _store: {
                    path: path
                }
            });
        });
    // }
}
