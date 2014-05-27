var sentinel = require('../');
var expect = require('chai').expect;
var redis = require('redis');

describe('Redis Sentinel tests', function() {

    describe('initial connection', function() {

        it('should get master correctly with single sentinel', function(done) {
            var endpoints = [{ host: '127.0.0.1', port: 26380}];
            var redisClient = sentinel.createClient(endpoints, 'mymaster');
            redisClient.on('ready', function() {
                expect(redisClient.host).to.equal('127.0.0.1');
                expect(redisClient.port).to.equal("6379");
                done();
            });
        });

        it('should get slave correctly with single sentinel', function(done) {
            var endpoints = [{ host: '127.0.0.1', port: 26380}];
            var redisClient = sentinel.createClient(endpoints, 'mymaster', {role:'slave'});
            redisClient.on('ready', function() {
                expect(redisClient.host).to.equal('127.0.0.1');
                expect(["6381", "6380"]).to.contain(redisClient.port);
                done();
            });
        });

        it('should get sentinel correctly with single sentinel', function(done) {
            var endpoints = [{ host: '127.0.0.1', port: 26380}];
            var redisClient = sentinel.createClient(endpoints, {role:'sentinel'});
            redisClient.on('ready', function() {
                expect(redisClient.host).to.equal('127.0.0.1');
                expect(redisClient.port).to.equal("26380");
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
                expect(redisClient.host).to.equal('127.0.0.1');
                expect(redisClient.port).to.equal("6379");
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
                expect(redisClient.host).to.equal('127.0.0.1');
                expect(["6381", "6380"]).to.contain(redisClient.port);
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
                expect(redisClient.host).to.equal('127.0.0.1');
                expect(redisClient.port).to.equal("26380");
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
                expect(redisClient.host).to.equal('127.0.0.1');
                expect(redisClient.port).to.equal("6379");
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
                expect(redisClient.host).to.equal('127.0.0.1');
                expect(["6381", "6380"]).to.contain(redisClient.port);
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
                expect(redisClient.host).to.equal('127.0.0.1');
                expect(redisClient.port).to.equal("26380");
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

        it('should give an error when running a command and no sentinels are active and enable_offline_queue is false', function(done) {
            this.timeout(2000);
            var endpoints = [ { host: 'asdf', port: 1}];
            var redisClient = sentinel.createClient(endpoints, 'mymaster', {enable_offline_queue: false});
            redisClient.set('key','val',function(err,results){
                expect(err).to.not.be.null;
                done();
            });
        });
    });
});
