(function(window, angular, undefined) {'use strict';
////console.log('registering happn');

if (!HappnClient)
   throw 'Happn browser client library not referenced';

angular.module('happn', [])

.factory('happnClient', ['$window', function(wind) {
 return {
      connect:function(host, port, secret, done){
         var _this = this;
         
         console.log('in connect method', wind.HappnClient);

         wind.HappnClient.create({config:{host:host, port:port, secret:secret}}, function(e, clientInstance){

            if (!e)
               _this.client = clientInstance;

            done(e);

         });
      }
   }
}])

})(window, window.angular);

