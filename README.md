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
```

## TODO ##
* Support for if the master changes but doesn't go down
* We could probably be cleverer with reconnects etc. and there may be issues with the error handling

