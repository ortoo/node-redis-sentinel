node-redis-sentinel
===================

Sentinel client for redis

```javascript
var sentinel = require('redis-sentinel');

// List the sentinel endpoints
var endpoints = [
    {host: '127.0.0.1', port: 26379},
    {host: '127.0.0.1', port: 26380}
];

var opts = {}; // Standard node_redis client options
var masterName = 'mymaster';

sentinel.createClient(endpoints, masterName, opts, function(err, masterClient) {
     // masterClient is a normal redis client, except that if the master goes down
     // it will keep checking the sentinels for a new master and then connect to that.
     // No need to monitor for reconnects etc - everything handled transparently
});

## TODO ##
* It would be nice to make createClient "synchronous" (in the same way that redis.createClient is synchronous) with request buffering etc.
* We could probably be cleverer with reconnects etc. and there may be issues with the error handling

