var Promise = require('bluebird')
  ;

module.exports = ProtocolHappn;

function ProtocolHappn(opts) {
  if (!opts) opts = {};
  this.opts = opts;
}

ProtocolHappn.prototype.validate = Promise.promisify(function(message, callback){

  var _this = this;

  try{

    if (!message.raw.action) throw _this.happn.services.error.ValidationError('message must have an action property');
    if (['on', 'get', 'set', 'off', 'remove', 'describe', 'emit', 'login'].indexOf(message.raw.action) == -1) throw _this.happn.services.error.ValidationError('Unknown request action: ' + message.raw['action']);

    callback(null, message);

  }catch(e){
    callback(e);
  }
});

ProtocolHappn.prototype.transform = Promise.promisify(function(message, callback){

  try{

    message.request = message.raw; //no change

    return callback(null, message);

  }catch(e){
    callback(e);
  }

});

ProtocolHappn.prototype.__formatReturnItem = function (item) {

  if (!item) return null;

  if (!item.data) item.data = {};

  var returnItem = item.data;

  returnItem._meta = item._meta;

  return returnItem;
};

ProtocolHappn.prototype.__formatReturnItems = function (items, local) {

  if (items == null) items = [];

  if (!Array.isArray(items)) items = [items];

  var returnItems = [];

  items.forEach(function (item) {
    returnItems.push(this.__formatReturnItem(item, local));
  }.bind(this));

  return returnItems;
};

ProtocolHappn.prototype.__createResponse = function (e, message, response, opts) {

  var _meta = {};

  if (!opts) opts = {};

  if (response == null) response = {data: null};

  else{

    if (response._meta) _meta = response._meta;
    if (response.paths) response = response.paths;
    if (response.data == null) response = {data: response};

    delete response.data._meta;//no need to double this up
  }

  _meta.type = 'response';
  _meta.status = 'ok';
  _meta.published = false;
  _meta.eventId = message.eventId;

  delete _meta._id;

  //we need these passed in case we are encrypting the resulting payload
  if (['login', 'describe'].indexOf(message.action) > -1) {
    _meta.action = message.action;
  } else {
    _meta.sessionId = message.sessionId;
    _meta.action = message.action;
  }

  response._meta = _meta;

  if (e) {

    response._meta.status = 'error';

    response._meta.error = {name: e.toString()};

    if (typeof e === 'object') {
      Object.keys(e).forEach(function (key) {
        response._meta.error[key] = e[key];
      });
    }

    return response;
  }

  // if (['set', 'remove'].indexOf(message.action) > -1) {
  //   if (!message.options || !message.options.noPublish) {
  //     this.publish(message, response);
  //   }
  //   return response;
  // }

  if (message.action == 'on' && (message.options.initialCallback || message.options.initialEmit))
    response.data = this.__formatReturnItems(response.initialValues, opts.local);

  if (Array.isArray(response)) {

    response = this.__formatReturnItems(response, opts.local);

    if (!opts.local) response.push(_meta);//we encapsulate the meta data in the array, so we canpop it on the other side
    else response._meta = _meta;// the _meta is preserved as an external property because we arent having to serialize
  }

  return response;
};

ProtocolHappn.prototype.emit = function(message, callback){

  try{

    var client = this.happn.services.session.getClient(message.sessionId);

    message.request.publication.protocol = this.happn.services.protocol.current();
    client.write(message.request.publication);

    callback(null, message);

  }catch(e){
    callback(e);
  }

};

ProtocolHappn.prototype.success = function(message){

  var _this = this;

  return new Promise(function(resolve, reject) {

    try{
      message.response = _this.__createResponse(null, message.request, message.response, message.opts);
      return resolve(message);
    }catch(e){
      return reject(e);
    }
  });
};

ProtocolHappn.prototype.fail = function(e, message){

  var _this = this;

  return new Promise(function(resolve, reject) {

    try{
      //we need to use the raw incoming message here - as we dont know whether request has been populated yet
      message.response = _this.__createResponse(e, message.raw, message.response, message.opts);
      return resolve(message);

    }catch(e){
      return reject(e);
    }
  });
};

