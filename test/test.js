var sentinel = require('../');
var expect = require('chai').expect;
var redis = require('redis');

describe('Redis Sentinel tests', function() {

    describe('initial connection', function() {

        it('should get master correctly with single sentinel', function(done) {
            var endpoints = [{ host: '127.0.0.1', port: 26380}];
            var redisClient = sentinel.createClient(endpoints, 'mymaster');
            redisClient.on('ready', function() {
                expect(redisClient.connectionOption.host).to.equal('127.0.0.1');
                expect(redisClient.connectionOption.port).to.equal("6379");
                done();
            });
        });

        it('should get slave correctly with single sentinel', function(done) {
            var endpoints = [{ host: '127.0.0.1', port: 26380}];
            var redisClient = sentinel.createClient(endpoints, 'mymaster', {role:'slave'});
            redisClient.on('ready', function() {
                expect(redisClient.connectionOption.host).to.equal('127.0.0.1');
                expect(["6381", "6380"]).to.contain(redisClient.connectionOption.port);
                done();
            });
        });

        it('should get sentinel correctly with single sentinel', function(done) {
            var endpoints = [{ host: '127.0.0.1', port: 26380}];
            var redisClient = sentinel.createClient(endpoints, {role:'sentinel'});
            redisClient.on('ready', function() {
                expect(redisClient.connectionOption.host).to.equal('127.0.0.1');
                expect(redisClient.connectionOption.port).to.equal("26380");
                done();
            });
        });

        it('should get master correctly with multiple sentinels', function(done) {
            var endpoints = [
                { host: '127.0.0.1', port: 26380},
                { host: '127.0.0.1', port: 26379}
            ];
            var redisClient = sentinel.createClient(endpoints);
            redisClient.on('ready', function() {
                expect(redisClient.connectionOption.host).to.equal('127.0.0.1');
                expect(redisClient.connectionOption.port).to.equal("6379");
                done();
            });
        });

        it('should get slave correctly with multiple sentinels', function(done) {
            var endpoints = [
                { host: '127.0.0.1', port: 26380},
                { host: '127.0.0.1', port: 26379}
            ];
            var redisClient = sentinel.createClient(endpoints, 'mymaster', {role:'slave'});
            redisClient.on('ready', function() {
                expect(redisClient.connectionOption.host).to.equal('127.0.0.1');
                expect(["6381", "6380"]).to.contain(redisClient.connectionOption.port);
                done();
            });
        });

        it('should get sentinel correctly with multiple sentinels', function(done) {
            var endpoints = [
                { host: '127.0.0.1', port: 26380},
                { host: '127.0.0.1', port: 26379}
            ];
            var redisClient = sentinel.createClient(endpoints, {role: 'sentinel'});
            redisClient.on('ready', function() {
                expect(redisClient.connectionOption.host).to.equal('127.0.0.1');
                expect(redisClient.connectionOption.port).to.equal("26380");
                done();
            });
        });


        it('should get master correctly with multiple sentinels - one not active', function(done) {
            var endpoints = [
                { host: '127.0.0.1', port: 26378},
                { host: '127.0.0.1', port: 26380},
                { host: '127.0.0.1', port: 26379}
            ];
            var redisClient = sentinel.createClient(endpoints, 'mymaster');
            redisClient.on('ready', function() {
                expect(redisClient.connectionOption.host).to.equal('127.0.0.1');
                expect(redisClient.connectionOption.port).to.equal("6379");
                done();
            });
        });

        it('should get slave correctly with multiple sentinels - one not active', function(done) {
            var endpoints = [
                { host: '127.0.0.1', port: 26378},
                { host: '127.0.0.1', port: 26380},
                { host: '127.0.0.1', port: 26379}
            ];
            var redisClient = sentinel.createClient(endpoints, 'mymaster', {role:'slave'});
            redisClient.on('ready', function() {
                expect(redisClient.connectionOption.host).to.equal('127.0.0.1');
                expect(["6381", "6380"]).to.contain(redisClient.connectionOption.port);
                done();
            });
        });

        it('should get sentinel correctly with multiple sentinels - one not active', function(done) {
            var endpoints = [
                { host: '127.0.0.1', port: 26378},
                { host: '127.0.0.1', port: 26380},
                { host: '127.0.0.1', port: 26379}
            ];
            var redisClient = sentinel.createClient(endpoints, {role: 'sentinel'});
            redisClient.on('ready', function() {
                expect(redisClient.connectionOption.host).to.equal('127.0.0.1');
                expect(redisClient.connectionOption.port).to.equal("26380");
                done();
            });
        });

        it('should return an instance of RedisClient', function(){
            var endpoints = [
                { host: 'bad.addr', port: 26378},
                { host: '127.0.0.1', port: 26380},
                { host: '127.0.0.1', port: 26379}
            ];
            var redisClient = sentinel.createClient(endpoints);
            expect(redisClient).to.be.an.instanceof(redis.RedisClient);
        });

        it('should give an error when no sentinels are active', function(done) {
            var endpoints = [
                { host: '127.0.0.1', port: 26378},
                { host: '127.0.0.1', port: 26377},
                { host: '127.0.0.1', port: 26376}
            ];
            var redisClient = sentinel.createClient(endpoints, 'mymaster');
            redisClient.on('error', function(err){
                expect(err.message).to.equal('Failed to find a sentinel from the endpoints');
                done();
            });
        });
    });

    describe('data writing', function() {

        var redisClient;

        before(function() {
            var endpoints = [
                { host: '127.0.0.1', port: 26380},
                { host: '127.0.0.1', port: 26379}
            ];
            redisClient = sentinel.createClient(endpoints);
            redisClient.select(9);
        });

        it('should write a key and return it', function(done) {
            redisClient.set('__test__', 'some value', function(err) {
                expect(err).to.be.null;
                redisClient.get('__test__', function(err, val) {
                    expect(err).to.be.null;
                    expect(val).to.equal('some value');
                    done();
                });
            });
        });
    });

    describe('client management', function () {
        it('should clear client entries when they quit', function (done) {
            var endpoints = [{host: '127.0.0.1', port: 26380}];
            var instance = sentinel.Sentinel(endpoints);
            var redisClient1 = instance.createClient('mymaster');
            redisClient1.on('ready', function () {
                // one pubsub, one actual
                expect(instance.clients.length).to.equal(2);

                var redisClient2 = instance.createClient('mymaster');
                redisClient2.on('ready', function () {
                    expect(instance.clients.length).to.equal(3);
                    redisClient2.quit();
                });

                redisClient2.on('end', function () {
                    expect(instance.clients.length).to.equal(2);
                    expect(redisClient2.info()).to.not.be.ok;

                    redisClient1.info(function(err, info) {
                        expect(err).to.be.null;
                        expect(info).to.be.ok;

                        done();
                    });
                });
            });
        });

        it('should eventually clear client entries when reconnecting', function (done) {
            var endpoints = [{host: '127.0.0.1', port: 26380}];
            var instance = sentinel.Sentinel(endpoints);
            var redisClient1 = instance.createClient('mymaster');
            redisClient1.on('ready', function () {
                // one pubsub, one actual
                expect(instance.clients.length).to.equal(2);

                var redisClient2 = instance.createClient('mymaster');
                redisClient2.on('ready', function () {
                    expect(instance.clients.length).to.equal(3);
                    redisClient2.end();

                    instance.reconnectAllClients();
                    expect(instance.clients.length).to.equal(2);

                    expect(redisClient2.info()).to.not.be.ok;

                    redisClient1.info(function(err, info) {
                        expect(err).to.be.null;
                        expect(info).to.be.ok;

                        done();
                    });
                });
            });
        });
    });
});
