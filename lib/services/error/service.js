var Promise = require('bluebird');

module.exports = ErrorService;

function AccessDenied(message, reason) {

  this.name = 'AccessDenied';
  this.code = 403;
  this.message = message;

  if (reason) this.reason = reason;
}

AccessDenied.prototype = Error.prototype;

function ResourceNotFound(message) {

  this.name = 'ResourceNotFound';
  this.code = 404;
  this.message = message;
}

ResourceNotFound.prototype = Error.prototype;

function SystemError(message, reason) {

  this.name = 'SystemError';
  this.code = 500;
  this.message = message;

  if (reason) this.reason = reason;
}

SystemError.prototype = Error.prototype;

function ValidationError(message, fields) {

  this.name = 'ValidationError';
  this.code = 500;
  this.message = message;

  if (fields) this.fields = fields;
}

ValidationError.prototype = Error.prototype;

function ErrorService() {}

ErrorService.prototype.AccessDeniedError = function (message, reason) {

  return new AccessDenied(message, reason);
};

ErrorService.prototype.ResourceNotFoundError = function (message, reason) {

  return new ResourceNotFound(message, reason);
};

ErrorService.prototype.SystemError = function (message, reason) {

  return new SystemError(message, reason);
};

ErrorService.prototype.ValidationError = function (message, reason) {

  return new ValidationError(message, reason);
};

ErrorService.prototype.handleSystem = function(e, area){
  if (!area) area = 'System';
  this.happn.services.log.write('system error', 'error', this.SystemError(e.toString()), area);
};

ErrorService.prototype.handleFatal = function(message, e, area){
  if (!area) area = 'System';
  this.happn.services.log.write('fatal error', 'fatal', this.SystemError(e.toString()), area);
  process.exit(1);
};
