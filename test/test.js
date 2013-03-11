var sentinel = require('../');
var expect = require('chai').expect;

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

        it('should get master correctly with multiple sentinels', function(done) {
            var endpoints = [
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

        it('should give an error when no sentinels are active', function(done) {
            var endpoints = [
                { host: '127.0.0.1', port: 26378},
                { host: '127.0.0.1', port: 26377},
                { host: '127.0.0.1', port: 26376}
            ];
            var redisClient = sentinel.createClient(endpoints, 'mymaster');
            redisClient.on('error', function(err){
                expect(err.message).to.equal('Failed to find a master from any of the sentinels');
                done();
            });
        });
    });
});