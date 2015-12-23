1.1.2 2015-12-03
----------------
 - happn instances now have names, they can either be in the config {name:'[configured name]'} - or the get instantiated with a unique sillyname_shortid combination
 - EMBEDDED MODE all system data /SYSTEM/* is pushed to the default db
 - EMBEDDED MODE if a default datastore is not selected, we take the first persisted datastore and set it as the default, if there is no persisted datastore, we take the first datastore and make it the default

1.1.3 2015-12-06
----------------

- moved logger out into own module [happn-logger](https://github.com/happner/happn-logger)
- no functional difference

1.1.4 2015-12-08
----------------

- fixed issue with users and groups being updated, and passed directly up to the client - was causing a scope issue.
- found an issue with the pubsub event emitter, test b3_login_info

1.1.5 2015-12-18
----------------

- fixed issue with disconnection not working between tests, pubsub service now disconnects properly - and client also has a disconnect call that works

1.2.6 2015-12-23
----------------

- fixed issue where _meta is passed into return arrays on .get
- improved search functionality, no longer any need to prepend search criteria/fields etc. with data.
- modified to use the forked version of nedb, which stores created and modified dates as UTC values, and allows for the deep picking of fields when projecting

