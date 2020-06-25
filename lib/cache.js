var NodeCache = require('node-cache');

exports.Cache = function() {

    var that = {};
    that.myCache = new NodeCache();

    that.store = function(key, value, ttl) {
        that.myCache.set(key, value, ttl);
    }

    that.load = function(key) {
        return that.myCache.get(key);
    }

    that.exists = function(key) {
        return that.myCache.has(key);
    }

    return that;

}


