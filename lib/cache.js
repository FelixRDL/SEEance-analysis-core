const NodeCache = require('node-cache')

exports.Cache = function () {
  const that = {}
  that.myCache = new NodeCache()

  that.store = function (key, value, ttl) {
    that.myCache.set(key, value, ttl)
  }

  that.load = function (key) {
    return that.myCache.get(key)
  }

  that.keys = function () {
    return that.myCache.keys()
  }

  that.delete = function (key) {
    that.myCache.del(key)
  }

  that.exists = function (key) {
    return that.myCache.has(key)
  }

  return that
}
