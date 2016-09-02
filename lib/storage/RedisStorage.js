/**
 * Basic Config Variables
 * redis_url (string) - Redis hostname (defaults to localhost)
 * ttl (int) - TTL on keys set in redis (defaults to 1 day)
 */
var redis_url = process.env.REDISTOGO_URL || process.env.REDISCLOUD_URL || process.env.REDISGREEN_URL || process.env.REDIS_URL || "redis://127.0.0.1:6379",
    url = require('url');

// Parse out the connection vars from the env string.
var connection = url.parse(redis_url),
    redis = require('redis'),
    client = redis.createClient(connection.port, connection.hostname),
    redis_online = false,
    last_error = "",
    last_end_message = ""; // Make redis connection

// Select Redis database, parsed from the URL
connection.path = (connection.pathname || '/').slice(1);
connection.database = connection.path.length ? connection.path : '0';
client.select(connection.database);

// Parse out password from the connection string
if (connection.auth) {
    client.auth(connection.auth.split(":")[1]);
}

// Catch all error handler. If redis breaks for any reason it will be reported here.
client.on("error", function (err) {
    if(last_error === err.toString()) {
        // Swallow the error for now
    } else {
        last_error = err.toString();
        console.log("Redis Cache Error: " + err);
    }
});
//
client.on("ready", function () {
    redis_online = true;
    console.log("Redis Cache Connected");
});

client.on("end", function (err) {
    if(err) {
        err = err.toString();
        if(last_end_message == err) {
            // Swallow the error for now
        } else {
            last_end_message = err;
            redis_online = false;
            console.log("Redis Cache Conncetion Closed. Will now bypass redis until it's back.");
        }
    }
});

module.exports = RedisStorage;

function RedisStorage(options) {
    this.ttl = options.ttl;
    this._table = {};
}

RedisStorage.prototype = {

    get: function(key, callback) {
        if (redis_online !== true) {
            return callback && callback(null, null);
        }

        client.get(key, function (err, result) {
            callback && callback(null, JSON.parse(result));
        });
    },

    put: function(value, callback) {
        if (redis_online !== true) {
            return callback && callback(null, value);
        }

        var self = this;

        client.set(value.url, JSON.stringify(value), function (err, reply) {
            // If library set to cache set an expiry on the key.
            if (!err && reply && self.ttl && self.ttl != 0) {
                client.expire(value.url, self.ttl, function (err, didSetExpiry) {
                    console.warn(!!didSetExpiry);
                });
            }
        });

        callback && callback(null, value);
    }

};
