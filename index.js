var redis = require('redis'),
    net = require('net'),
    Q = require('q');

/**
 * Try and resolve a master server from a specific sentinel endpoint
 * @param  {[type]}   endpoint   [description]
 * @param  {[type]}   masterName [description]
 * @param  {Function} callback   [description]
 * @return {[type]}              [description]
 */
function resolveMasterFromSentinel(endpoint, masterName, callback) {
    var sentinelClient = redis.createClient(endpoint.port, endpoint.host);
    var callbackSent = false;

    // If there is an error then callback with it
    sentinelClient.on("error", function(err) {
        if (!callbackSent) {
            callbackSent = true;
            callback(err);
        }
    });

    sentinelClient.send_command('SENTINEL', ['get-master-addr-by-name', masterName], function(err, result) {
        if (callbackSent) { return; }
        callbackSent = true;

        if (err) { return callback(err); }

        // Test the response
        if (result === null) {
            callback(new Error("Unkown master name: " + masterName));
        } else {
            var ip = result[0];
            var port = result[1];
            callback(null, ip, port);
        }
    });
}

/**
 * [createClient description]
 * @param  {[type]} endpoints  [description]
 * @param  {[type]} masterName [description]
 * @param  {[type]} options    [description]
 * @return {[type]}            [description]
 */
function createClient(endpoints, masterName, options) {

    if (typeof masterName === 'undefined' || masterName === null) {
        masterName = 'mymaster';
    } else if (typeof masterName === 'object') {
        options = masterName;
        masterName = 'mymaster';
    }

    /**
     * Resolves a master from the sentinel endpoints. Follows the guidelines
     * here: http://redis.io/topics/sentinel-clients
     */
    function resolveMaster(callback) {

        var promise = Q.resolve();

        // Because finding the master is going to be an async list we will terminate
        // when we find one then use promises...
        promise = endpoints.reduce(function(soFar, endpoint) {
            return soFar.then(function() {
                var deferred = Q.defer();
                resolveMasterFromSentinel(endpoint, masterName, function(err, ip, port) {
                    if (err) {
                        // We received an error so resolve our deferred to move onto the
                        // next endpoint - maybe log or something here...
                        deferred.resolve();
                    } else {
                        // We have an IP/port for our master - stick this endpoint on top
                        // of our list of endpoints
                        var index = endpoints.indexOf(endpoint);
                        endpoints.splice(index, 1);
                        endpoints.unshift(endpoint);

                        // TODO - we could also fetch all the sentinels for this master from this
                        // responding sentinel and update the endpoints array.

                        // Callback with the IP address
                        callback(null, ip, port);
                    }
                });
                return deferred.promise;
            });
        }, promise);

        promise.then(function() {
            // If we've got this far then we've failed to find a master from any
            // of the sentinels. Callback with an error.
            callback(new Error('Failed to find a master from any of the sentinels'));
        });
    }

    var netClient = new net.Socket();
    var redisClient = new redis.RedisClient(netClient, options);

    // Resolve the master redis server from the sentinel endpoints
    resolveMaster(function(err, ip, port) {
        if (err) { redisClient.emit('error', err); }

        redisClient.port = port;
        redisClient.host = ip;
        redisClient.stream.connect(port, ip);

        // Hijack the emit method so that we can get in there and
        // do any reconnection on errors, before raising it up the
        // stack...
        var oldEmit = redisClient.emit;
        redisClient.emit = function(eventName) {

            // Has an error been hit?
            if (eventName === 'error') {
                hitError.apply(null, arguments);
            } else {
                // Not an error - call the real emit...
                oldEmit.apply(redisClient, arguments);
            }
        };

        // Crude but may do for now. On error re-resolve the master
        // and retry the connection
        function hitError(eventName, err) {

            var _args = arguments;
            function reemit() {
                oldEmit.apply(redisClient, _args);
            }

            // If we are still connected then reraise the error - thats
            // not what we are here to handle
            if (redisClient.connected) { return reemit(); }

            // In the background the client is going to keep trying to reconnect
            // and this error will keep getting raised - lets just keep trying
            // to get a new master...
            resolveMaster(function(_err, ip, port) {
                if (_err) { oldEmit.call(redisClient, 'error', _err); }

                // Try and reconnect
                redisClient.port = port;
                redisClient.host = ip;
            });
        }
    });

    return redisClient;
}

module.exports.createClient = createClient;
module.exports.redis = redis;