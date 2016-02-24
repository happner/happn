describe('c6_backward_compatible_db', function() {

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var serviceConfig = {secure:true};
  var serviceInstance;

  var fs = require('fs');

  this.timeout(5000);

  function createService(config, callback){

    service.create(config,
    function(e, happnInst){
      if (e)
        return callback(e);

      callback(null, happnInst);
    });

  }

  it('starts up all the dbs in the backwards compatable folder', function(callback) {

    var dbFiles = fs.readdirSync(__dirname + '/required-dta/c6');

    async.eachSeries(dbFiles, function(fileName, eachCallback){

      if (fileName == 'test') return eachCallback();

      var testFile = __dirname + '/required-dta/c6/test/' + fileName + '.test';

      fs.createReadStream(__dirname + '/required-dta/c6/' + fileName).pipe(fs.createWriteStream(testFile));

      var config = {
        secure:true,
        services: {
          data: {
            path: './services/data_embedded/service.js',
            config:{
               filename:testFile
            }
          }
        }
      }

      console.log('creating service from db file:' + fileName);

      createService(config, function(e, service){

        if (e) {
          fs.unlinkSync(testFile);
          return eachCallback(e)
        };

        service.stop(function(e){

          if (e) {
            fs.unlinkSync(testFile);
            return eachCallback(e)
          };

          createService(config, function(e, restartedService){
               if (e) {
                fs.unlinkSync(testFile);
                return eachCallback(e)
              };

              restartedService.stop(function(e){
                fs.unlinkSync(testFile);
                eachCallback();
              });

          });//start it again after modifications may have happened

        });

      });

    }, callback);

  });

});