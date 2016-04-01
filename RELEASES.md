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

2.1.7 2016-01-02
----------------

- fixed issue where null data is returned as an object with only _meta for the websocket client, updated the tests

2.2.0 2016-01-04
----------------

- broke the initialization ocde out, into services module and transport module
- the transport module now allows for happn to run in https mode

2.3.0 2016-01-12
----------------

- web token functionality added, so web requests are also vetted by the security component
- fixed an issue whereby the password is being passed back when a user is updated, subsequent updates cause the hash being stored as a password

2.3.1 2016-01-13
----------------

- fixed issue where web token was being passed as a qs argument
- added functionality for exclusions on web paths

2.3.2 2016-01-18
----------------

- added .services.security.config.cookieName and .services.security.config.cookieDomain
- fixed '/' webmethod exclusion was effectively '/*', allowing entire site without authentication
- added username to session token
- fixed unmounted connect app when https

2.4.0 2016-01-20
----------------

- added crypto service, and happn-crypto utility
- added encrypt payloads functionality
- handle circular references maximum callstack error a bit better

2.4.1 2016-01-21
----------------

- fixed issue where the publicKey wasnt getting to the server on logins where the keypair is generated on the client

2.4.2 2016-01-21
----------------

- fixed issue where the browser version of the client was attempting to require the crypto library when it was already in the window
- have browser tests all passing for encrypted payloads

2.4.3 2016-01-23
----------------

- fixed issue with client not initializing properly if Primus already exists in the browser

2.4.4 2016-02-11
----------------

- fixed issue with deleting group

2.4.5 2016-02-14
----------------

- setSibling and tagging now uses uuid instead of shortid
- fixed issue with .off incorrectly assuming 0 is a null reference

2.5.0 2016-02-18
----------------

- pubsub now emits 'disconnect' and 'authentic' events for both eventEmitter and socket clients, the events now contain the sessionid
- the sessionId for all clients is now a guid instead of a shortid

2.5.1 2016-02-19
----------------

- client now emits 'reconnect-scheduled','reconnect-successful','connection-ended' events

2.5.2 2016-02-22
----------------

- the security service now has a 'matchPassword' function, how we can do password validation without requiring a login

2.5.3 2016-02-22
----------------

- the security service only raises an error when a new user is being saved without a password, by looking up - instead of checking for a _meta tag

2.5.4 2016-02-22
----------------

- removed a console.log in the client base

2.5.5 2016-02-24
----------------

- have db backwards compatability fix in place, change after version 1.5.6

2.5.7 2016-02-24
----------------

- test data added, this wasnt working because git ignored test-data folder regardless of it being configured, bunch of publishes to fix this

2.5.8 2016-03-02
----------------

- fixed the the backwards compatability db feature, as we were checking for the wrong error string
- display happn version on startup

2.5.9 2016-03-02
----------------

- adjustments to the security, system services for compatability with the mongo plugin

2.5.10 2016-03-07
-----------------

- the happn client reflects the commented version of happn at the top of the script


2.5.12-13 2016-03-10
--------------------

- adjusted crypto utilities
- fixed test timeouts

2.5.15 2016-03-17
-----------------

- fixed caching bug in security module, https://github.com/happner/happner/issues/74

2.5.16 2016-04-01
-----------------

- Fixed memory leak in meshClient (#23)
- Fixed noPublish check (#22)





