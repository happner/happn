1.1.2
-----
 - happn instances now have names, they can either be in the config {name:'[configured name]'} - or the get instantiated with a unique sillyname_shortid combination
 - EMBEDDED MODE all system data /SYSTEM/* is pushed to the default db
 - EMBEDDED MODE if a default datastore is not selected, we take the first persisted datastore and set it as the default, if there is no persisted datastore, we take the first datastore and make it the default
