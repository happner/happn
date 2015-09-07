var _s = require('underscore.string');
var utc = require('moment').utc();
var traverse = require('traverse');
var ObjectID = require('mongodb').ObjectID;
var shortid = require('shortid');

module.exports = DataService;

function DataService() {}


DataService.prototype.initialize = function(config, done){
    var _this = this;
    var Datastore = require('mongodb');
    var MongoClient = Datastore.MongoClient;

    if (!config.host)
        config.host = '127.0.0.1';

    if (!config.port)
        config.port = '27017';

    if (!config.db)
        config.db = 'happn';

    if (!config.collection)
        config.collection = 'happn';

     MongoClient.connect('mongodb://' + config.host + ':' + config.port + '/' + config.db, function(err, db) {
        if(err) done(err);
        else{

            db.ensureIndex('path_index', {path:1}, {unique:true, w:1}, function(e, indexName){

                if (!e){
                    _this.config = config;
                    _this.db = db.collection(config.collection); 
                    _this.ObjectID = Datastore.ObjectID;

                    //console.log('indexName');
                    //console.log(indexName);
                    done();
                }else
                    done(e);

            });
        }
    });

}

DataService.prototype.getOneByPath = function(path, callback){
     var _this = this;
     ////////////console.log('in getOneByPath');
     ////////////console.log(_this.db);

     _this.db.findOne({path:path}, function(e, findresult){

        if (e)
            return callback(e);

        return callback(null, findresult);

     });
}

DataService.prototype.getArrayByPath = function(path, callback){
    var _this = this;

    ////////////console.log('in getArrayByPath');
    ////////////console.log(_this.db);

    _this.db.find({path:path}).toArray(function(err, findresults) {

        if (err)
            return callback(err);

        return callback(null, findresults);

    });
}

DataService.prototype.saveTag = function(path, tag, data, callback){
     var _this = this;

     ////////////console.log('doing tag insert');
     ////////////console.log(path);
     ////////////console.log(tag);


     var insertTag = function(snapshotData){

        //////////console.log('tag inserting...');
        

        var tagData = {
            snapshot:snapshotData,
            path:path + '/tags/' + shortid.generate()
        }

        //////////console.log(tagData);

        _this.db.insert(tagData, function(e, response){

            ////////console.log('tag inserted');
            ////////console.log(e);
            ////////console.log(response.ops);

            if (e)
                callback(e);
            else{
                
                ////////console.log('tag inserted value');
                ////////console.log(response.ops);
                callback(null, response.ops);
            }
               

        });
     }

     if (!data){

        _this.getOneByPath(path, function(e, found){

            if (e)
                return callback(e);

            if (found)
            {
                ////////console.log('about to tag insert from zero data...');
                ////////console.log(found);
                insertTag(found);
            }   
            else
                return callback('Attempt to tag something that doesn\'t exist in the first place');
        });

     }else
         insertTag(data);
}

DataService.prototype.parseBSON = function(criteria){

    var _this = this;
    ////////////console.log('traversing criteria');
    ////////////console.log(criteria);

    traverse(criteria).forEach(function (value) {
        if (value && value.bsonid){
            if (_this.ObjectID)
                this.update(new ObjectID(value.bsonid));
            else
                this.update(value.bsonid);//EMBEDDED DIFFERENCE
        } 
    });

    ////////////console.log('done traversing criteria');
    ////////////console.log(criteria);

    return criteria;

}

DataService.prototype.process = function(message, callback) {

    var _this = this;

    var nodes = message.path.split('/');
    var subdocument = nodes.join('.');

    try{

        if (message.action == 'GET'){

            try{
                var criteria = {};
                var columns = null;

                 if (message.params.child_id){
                    criteria = {path:message.path, "data._id": message.params.child_id};
                    columns = {_id: 0, 'data.$': 1};
                 }  
                 else if (message.path.indexOf('*') >= 1){//we only do starts with searches
                    criteria = {path:{ $regex: new RegExp('^' + message.path.replace('*',''))}};
                    ////////////console.log('REGEX CRITERIA');
                    ////////////console.log(criteria);
                    if (message.params.path_only)
                        columns = { path: 1 };
                 }
                 else{
                    criteria = {path:message.path};
                 } 

                if (columns)
                    _this.db.find(criteria, columns, function(e, cursor){
                       ////////////console.log('DOING FIND - cursor');
                       ////////////console.log(cursor);
                       ////////////console.log(e);
                       callback(e, cursor);
                     });
                else
                    _this.db.find(criteria, function(e, cursor){
                       ////////////console.log('DOING FIND - cursor');
                       ////////////console.log(cursor);
                       ////////////console.log(e);
                       callback(e, cursor);
                     });

            }catch(e){
                callback(e);
            }

        }
        else if (message.action == 'POST'){
            //this is how we search for things - so more complex queries

            try{

                var cursor = null;
                var criteria = _this.parseBSON(message.data.criteria);
                var fields = message.data.fields;
                var sort = message.data.sort;

                if(!fields)
                   fields = {};
               

                if(!criteria)
                    criteria = {};
               
                if (message.path.indexOf('*') > 0)
                    cursor = _this.db.find({$and:[{path:{ $regex: new RegExp('^' + message.path.replace('*','')) }},criteria]}, fields);
                else
                    cursor = _this.db.find({$and:[{path:message.path},criteria]}, fields);

                if (message.data.sort)
                    cursor = cursor.sort(message.data.sort);

                if (message.data.limit)
                    cursor = cursor.limit(message.data.limit);

                callback(null, cursor);

            }catch(e){
                //////////console.log(e);
                callback(e);
            }
        }
        else if (message.action == 'PUT'){

            var timestamp = utc.valueOf(); // check to see that this is doing what you think it's doing

             ////////console.log('DOING PUT....!');

            var regularPUT = function(){

                if (message.data instanceof Array)
                message.data.map(function(item, index, array){

                    if (item._id == null)
                        item = {data:item, _id: shortid.generate(), modified:timestamp};
                   
                    array.splice(index, 1, item);
                       
                });

                var setData = {data:message.data, modified:timestamp};
                var params = message.params?message.params:{};

                if (params.tag)
                    setData.tag = params.tag;

                var setParameters = {$set: setData};
                var dataWasMerged = false;

                setParameters.$setOnInsert = {created:timestamp};

                var upsert = function(){

                    _this.db.update({path:message.path}, setParameters, {w:1, upsert:true}, function(err, updateResponse) {
                        if (!err){

                            //console.log('upsert response');
                            //console.log(updateResponse);
                            //console.log(setData);

                            if (dataWasMerged && !params.tag)
                                return callback(null, setData); //this is because we already have the path and id

                            if (!dataWasMerged && params.tag){ // we dont have a prefetched object, but we want to tag

                                ////////////console.log('!dataWasMerged && params.tag come one!!!');
                                ////////////console.log(message.path);
                                ////////////console.log(params.tag);

                                _this.saveTag(message.path, params.tag, null, function(e, taggedResponse){

                                    if (e)
                                        return callback(e);

                                    return callback(null, taggedResponse.result);
                                });
                            }

                            if (dataWasMerged && params.tag){ // we have a prefetched object, and we want to tag it

                                ////////console.log('dataWasMerged && params.tag come one!!!');
                                ////////console.log(message.path);
                                ////////console.log(params.tag);

                                _this.saveTag(message.path, params.tag, setData, function(e, taggedResponse){

                                    if (e)
                                        return callback(e);

                                    return callback(null, taggedResponse);
                                });
                            }
                            
                            if (!dataWasMerged && !params.tag){ // no prefetched object, and we dont need to tag - we need to fetch the object

                                _this.getOneByPath(message.path, function(e, fetchedResponse){

                                    if (!e){
                                        setData._id = fetchedResponse._id;
                                        callback(null, setData);
                                    }
                                    else
                                        callback(e);

                                });
                            }

                        }else
                            callback(err);

                    }.bind(_this));
                }

                if (params.merge){

                     _this.getOneByPath(message.path, function(e, result){

                        if (e)
                            return callback(e);

                        if (!result)
                            return upsert();//no data to merge, all good

                        var previous = result.data;
                        
                        for (var propertyName in previous)
                            if (!setData.data[propertyName])
                                setData.data[propertyName] = previous[propertyName];
                        
                        dataWasMerged = true;

                        ////////////console.log('DATA WAS MERGED');
                        ////////////console.log(setData);

                        upsert();

                     });

                }else
                    upsert();

            }

            if (message.params.set_type == 'child'){
                //adds a child to a collection that sits at the given path
                 var posted = {data:message.data, _id: require('shortid').generate(), modified:timestamp};

                _this.db.update({path:message.path}, {$push: {data:posted}}, {upsert:true}, function(err, updatedCount) {

                   if (!err)
                    callback(err, posted);
                   else
                    callback(err);
                });

            }else if (message.params.set_type == 'sibling'){
                //appends an item with a path that matches the message path - but made unique by a shortid at the end of the path
                if (!_s.endsWith(message.path, '/')) message.path += '/';
                message.path += require('shortid').generate();
                regularPUT();

            }else{
                regularPUT();
            }
        }
        else if (message.action == 'DELETE'){
            if (message.params.child_id){
                 _this.db.update({path:message.path}, { $pull: { data: {'_id':message.params.child_id}}}, function(err, response){
                    callback(err, {data:message.params.child_id, removed:response.result.n});
                 });     
            }else{

                var criteria = {path:message.path};

                if (message.path.indexOf('*') > -1)
                    criteria = {path:{ $regex: message.path }};

                _this.db.remove(criteria, {w:1}, function(e, response){

                    if (e)
                        return callback(e);

                    callback(null, {data:message.path, removed:response.result.n});
                });                  
            }

        }else{
            throw new Error('Bad action: ' + message.action);
        }
            
    }catch(e){
        callback(e);
    }
}
