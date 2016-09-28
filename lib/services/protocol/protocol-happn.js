var Promise = require('bluebird')
  ;

module.exports = ProtocolHappn;

function ProtocolHappn(opts) {
  if (!opts) opts = {};
  this.opts = opts;
}

ProtocolHappn.prototype.validate = Promise.promisify(function(message, callback){

  if (!message.action) return callback(this.happn.services.error.validation('message must have an action property'));

  if (['on', 'get', 'set', 'off', 'remove'].indexOf(message.action) == -1) return callback(this.happn.services.error.validation('Unknown request action: ' + message['action']));

  return callback(null, message);
});

ProtocolHappn.prototype.transform = Promise.promisify(function(message, callback){
  return callback(null, message);
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

  items.map(function (item) {
    returnItems.push(this.__formatReturnItem(item, local));
  }.bind(this));

  return returnItems;
};

ProtocolHappn.prototype.__createResponse = function (e, message, response, opts) {

  if (!response) response = {data: null};

  var _meta = response._meta ? response._meta : {};

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

  if (response.paths) response = response.paths;

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

  if (message.action == 'on' && (message.options.initialCallback || message.options.initialEmit)) response.data = this.__formatReturnItems(response.initialValues, opts.local);

  if (Array.isArray(response)) {

    response = this.__formatReturnItems(response, opts.local);

    if (!opts.local) response.push(_meta);//we encapsulate the meta data in the array, so we canpop it on the other side
    else response._meta = _meta;// the _meta is preserved as an external property because we arent having to serialize
  }

  return response;
};

ProtocolHappn.prototype.success = function(message, callback){
  callback(this.__createResponse(null, message.request, message.response, message.opts));
};

ProtocolHappn.prototype.fail = function(e, message, callback){
  callback(this.__createResponse(e, message.request, message.response, message.opts));
};

