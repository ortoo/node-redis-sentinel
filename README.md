node-redis-sentinel
===================

Wrapper around [node_redis](https://github.com/mranney/node_redis) creating a client pointing at the master server which autoupdates when the master goes down.

```javascript
var sentinel = require('redis-sentinel');

// List the sentinel endpoints
var endpoints = [
    {host: '127.0.0.1', port: 26379},
    {host: '127.0.0.1', port: 26380}
];

var opts = {}; // Standard node_redis client options
var masterName = 'mymaster';

// masterName and opts are optional - masterName defaults to 'mymaster'
var redisClient = sentinel.createClient(endpoints, masterName, opts);

// redisClient is a normal redis client, except that if the master goes down
// it will keep checking the sentinels for a new master and then connect to that.
// No need to monitor for reconnects etc - everything handled transparently
// Anything that persists over the normal node_redis reconnect will persist here. 
// Anything that doesn't, won't.

// An equivalent way of doing the above (if you don't want to have to pass the endpoints around all the time) is
var Sentinel = sentinel.Sentinel(endpoints);
var masterClient = Sentinel.createClient(masterName, opts);
```

## Connection to slaves or the sentinel itself ##
You can get a connection to a slave (chosen at random) or the first available sentinel from the endpoints by passing in the `role` attribute in the options. E.g.

```javascript
// The master is the default case if no role is specified.
var masterClient = sentinel.createClient(endpoints, masterName, {role: 'master'}); 
var slaveClient = sentinel.createClient(endpoints, masterName, {role: 'slave'});
var sentinelClient = sentinel.createClient(endpoints, {role: 'sentinel'});
```

Where you should also transparently get a reconnection to a new slave/sentinel if the existing one goes down.

## TODO ##
* We could probably be cleverer with reconnects etc. and there may be issues with the error handling

## Licence ##
MIT

