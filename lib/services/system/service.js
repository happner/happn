var shortid = require('shortid');
var sillyname = require('sillyname');

module.exports = SystemService;

function SystemService(opts) {

    this.log = opts.logger.createLogger('System');
    this.log.$$TRACE('construct(%j)', opts);

}

SystemService.prototype.uniqueName = function(){
    return sillyname().split(' ')[0].toLowerCase() + '_' + shortid.generate();
}

SystemService.prototype._ensureSystemName = function(config, callback){
    var _this = this;

    _this.dataService.get('/_SYSTEM/_NETWORK/_SETTINGS/NAME', {}, function(e, response){

        if (e) return callback(e);

        if (!response){

            if (!config.name)
                config.name = _this.uniqueName();

            return _this.dataService.upsert('/_SYSTEM/_NETWORK/_SETTINGS/NAME', config.name, {}, function(e, result){

                 if (e) return callback(e);
                 _this.name = result.data.value;
                 callback();

            });

        }else{
            _this.name = response.data.value;
        }

        callback();

    });
}

SystemService.prototype.initialize = function(config, done){
    var _this = this;
    _this.config = config;
    _this.dataService = this.happn.services.data;

    _this._ensureSystemName(config, function(e){
        if (e) return done(e);
        _this.log.info('instance name: ' + _this.name);
        _this.log.context = _this.name;
        done();
    });
}
