var redis = require('redis'),
    net = require('net'),
    when = require('when');

function Sentinel(endpoints) {

    // Instantiate if needed
    if (!(this instanceof Sentinel)) {
        return new Sentinel(endpoints);
    }

    this.endpoints = endpoints;
    this.clients = [];
    this.pubsub = [];
}

/**
 * Create a client
 * @param  {String} masterName the name of the master. Defaults to mymaster
 * @param  {Object} opts       standard redis client options (optional)
 * @return {RedisClient}       the RedisClient for the desired endpoint
 */
Sentinel.prototype.createClient = function(masterName, opts) {
    // When the client is ready create another client and subscribe to the
    // switch-master event. Then any time there is a message on the channel it
    // must be a master change, so reconnect all clients. This avoids combining
    // the pub/sub client with the normal client and interfering with whatever
    // the user is trying to do.
    if (this.pubsub.length == 0) {
        var self = this;
        var pubsubOpts = {};
        pubsubOpts.role = "sentinel";
        pubsubClient = this.createClientInternal(masterName, pubsubOpts);
        pubsubClient.subscribe("+switch-master", function(error) {
            if (error) {
                console.error("Unable to subscribe to Sentinel PUBSUB");
            }
        });
        pubsubClient.on("message", function(channel, message) {
            console.warn("Received +switch-master message from Redis Sentinel.",
                         " Reconnecting clients.");
            self.reconnectAllClients();
        });
        pubsubClient.on("error", function(error) {});
        self.pubsub.push(pubsubClient);
    }
    return this.createClientInternal(masterName, opts);
}

Sentinel.prototype.createClientInternal = function(masterName, opts) {
    if (typeof masterName !== 'string') {
        opts = masterName;
        masterName = 'mymaster';
    }

    opts = opts || {};
    var role = opts.role || 'master';

    var endpoints = this.endpoints;


    var netClient = new net.Socket();
    var client = new redis.RedisClient(netClient, opts);
    this.clients.push(client);

    var self = this;

    client.on('end', function() {
        // if we're purposefully ending, forget us
        if (this.closing) {
            var index = self.clients.indexOf(this);
            if (index !== -1) {
                self.clients.splice(index, 1);
            }
        }
    });

    function connectClient(resolver) {
        return function(err, host, port) {
            if (err) {
                return client.emit('error', err);
            }

            var connectionOption = {
                port: port,
                host: host
            };
            client.connectionOption = connectionOption;
            client.stream.connect(connectionOption.port, connectionOption.host);

            // Hijack the emit method so that we can get in there and
            // do any reconnection on errors, before raising it up the
            // stack...
            var oldEmit = client.emit;
            client.emit = function(eventName) {

                // Has an error been hit?
                if (eventName === 'error') {
                    hitError.apply(null, arguments);
                } else {
                    // Not an error - call the real emit...
                    oldEmit.apply(client, arguments);
                }
            };

            client.on('reconnecting', refreshEndpoints);

            function refreshEndpoints() {
                client.connectionOption.port = "";
                client.connectionOption.host = "";
                resolver(self.endpoints, masterName, function(_err, ip, port) {
                    if (_err) {
                        oldEmit.call(client, 'error', _err);
                    } else {
                        // Try reconnecting - remove the old stream first.
                        client.stream.end();
                        
                        client.connectionOption.port = port;
                        client.connectionOption.host = ip;
                        client.connection_gone("sentinel induced refresh");
                    }
                });
            }

            // Crude but may do for now. On error re-resolve the master
            // and retry the connection
            function hitError(eventName, err) {

                var _args = arguments;
                function reemit() {
                    oldEmit.apply(client, _args);
                }

                // If we are still connected then reraise the error - thats
                // not what we are here to handle
                if (client.connected) { return reemit(); }

                // In the background the client is going to keep trying to reconnect
                // and this error will keep getting raised - lets just keep trying
                // to get a new master...
                refreshEndpoints();
            }
        };
    }

    switch(role){
        case 'sentinel':
            resolveSentinelClient(endpoints, masterName, connectClient(resolveSentinelClient));
            break;

        case 'master':
            resolveMasterClient(endpoints, masterName, connectClient(resolveMasterClient));
            break;

        case 'slave':
            resolveSlaveClient(endpoints, masterName, connectClient(resolveSlaveClient));
    }

    return client;
};


/*
 * Ensure that all clients are trying to reconnect.
 */
Sentinel.prototype.reconnectAllClients = function() {
    // clients in 'closing' state were purposefully closed, and won't ever
    // reconnect; remove those from our clients before proceeding
    this.clients = this.clients.filter(function(client) { return !client.closing; });

    this.clients.forEach(function(client) {
        // It is safe to call this multiple times in quick succession, as
        // might happen with multiple Sentinel instances. Each client
        // records its reconnect state and will only try to reconnect if 
        // not already doing so.
        client.connection_gone("sentinel switch-master");
    });
};

function resolveClient() {
    var _i, __slice = [].slice;

    // The following just splits the arguments into the first argument (endpoints),
    // the last argument (callback) and then any arguments in the middle (args).
    var endpoints = arguments[0];
    var checkEndpointFn = arguments[1];
    var args = 4 <= arguments.length ? __slice.call(arguments, 2, _i = arguments.length - 1) : (_i = 2, []);
    var callback = arguments[_i++];

    /**
     * We use the algorithm from http://redis.io/topics/sentinel-clients
     * to get a sentinel client and then do 'stuff' with it
     */
    var promise = when.resolve();

    // Because finding the master is going to be an async list we will terminate
    // when we find one then use promises...
    promise = endpoints.reduce(function(soFar, endpoint) {
        return soFar.then(function() {
            var deferred = when.defer();

            // Farily illegible way of passing (endpoint, arg1, arg2, ..., callback)
            // to checkEndpointFn
            checkEndpointFn.apply(null, [endpoint].concat(args, [function() {
                var err = arguments[0];
                if (err) {
                    deferred.resolve();
                } else {
                    // This is the endpoint that has responded so stick it on the top of
                    // the list
                    var index = endpoints.indexOf(endpoint);
                    endpoints.splice(index, 1);
                    endpoints.unshift(endpoint);

                    // Callback with whatever other arguments we've been given
                    var _args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
                    callback.apply(null, [null].concat(_args));
                }
            }]));
            return deferred.promise;
        });
    }, promise);

    promise = promise.then(function() {
        // If we've got this far then we've failed to find whatever we are looking for from any
        // of the sentinels. Callback with an error.
        callback(new Error('Failed to find a sentinel from the endpoints'));
    });

    // Catch the failure (if there is one)
    promise.catch(function(err) { callback(err); });
}

function isSentinelOk(endpoint, callback) {
    var client = redis.createClient(endpoint.port, endpoint.host);
    var callbackSent = false;
    client.on("error", function(err) {
        if (!callbackSent) {
            callbackSent = true;
            callback(err);
        }
        client.end();
    });

    // Send a command just to check we can...
    client.info(function(err, resp) {
        if (callbackSent) { return; }
        callbackSent = true;
        if (err) { return callback(err); }
        callback(null, endpoint.host, String(endpoint.port));
    });
    client.quit();
}

function getMasterFromEndpoint(endpoint, masterName, callback) {
    var sentinelClient = redis.createClient(endpoint.port, endpoint.host);
    var callbackSent = false;

    // If there is an error then callback with it
    sentinelClient.on("error", function(err) {
        if (!callbackSent) {
            callbackSent = true;
            callback(err);
        }
        sentinelClient.end();
    });

    sentinelClient.send_command('SENTINEL', ['get-master-addr-by-name', masterName], function(err, result) {
        if (callbackSent) { return; }
        callbackSent = true;

        if (err) { return callback(err); }

        // Test the response
        if (result === null) {
            callback(new Error("Unknown master name: " + masterName));
        } else {
            var ip = result[0];
            var port = result[1];
            callback(null, ip, port);
        }
    });
    sentinelClient.quit();
}

function getSlaveFromEndpoint(endpoint, masterName, callback) {
    var sentinelClient = redis.createClient(endpoint.port, endpoint.host);
    var callbackSent = false;

    // If there is an error then callback with it
    sentinelClient.on("error", function(err) {
        if (!callbackSent) {
            callbackSent = true;
            callback(err);
        }
        sentinelClient.end();
    });

    sentinelClient.send_command('SENTINEL', ['slaves', masterName], function(err, result) {
        if (callbackSent) { return; }
        callbackSent = true;

        if (err) { return callback(err); }

        // Test the response
        if (result === null) {
            callback(new Error("Unknown master name: " + masterName));
        } else if(result.length === 0){
            callback(new Error("No slaves linked to the master."));
        } else {
            var slaveInfoArr = result[Math.floor(Math.random() * result.length)]; //range 0 to result.length -1
            if((slaveInfoArr.length % 2) > 0){
                callback(new Error("Corrupted response from the sentinel"));
            } else {
              var slaveInfo = parseSentinelResponse(slaveInfoArr);
              callback(null, slaveInfo.ip, slaveInfo.port);
            }
        }
    });
    sentinelClient.quit();
}

function resolveSentinelClient(endpoints, masterName, callback) {
    resolveClient(endpoints, isSentinelOk, callback);
}

function resolveMasterClient(endpoints, masterName, callback) {
    resolveClient(endpoints, getMasterFromEndpoint, masterName, callback);
}

function resolveSlaveClient(endpoints, masterName, callback) {
    resolveClient(endpoints, getSlaveFromEndpoint, masterName, callback);
}

function parseSentinelResponse(resArr){
    var response = {};
    for(var i = 0 ; i < resArr.length ; i+=2){
        response[resArr[i]] = resArr[i+1];
    }
    return response;
}

// Shortcut for quickly getting a client from endpoints
function createClient(endpoints, masterName, options) {
    var sentinel = Sentinel(endpoints);
    return sentinel.createClient(masterName, options);
}

module.exports.Sentinel = Sentinel;
module.exports.createClient = createClient;
module.exports.redis = redis;
