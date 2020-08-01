exports.Topicality = function () {
  const that = {}

  const items = {}
  const STANDARD_TTL = 360000

  // Register a new refresh
  that.registerRefresh = function (key) {
    items[key] = new Date()
  }

  // Check, whether last update is still fresh enough
  that.isFresh = function (key) {
    const ttl = process.env.topicality_ttl || STANDARD_TTL
    if (!items[key]) {
      return false
    } else {
      return ((new Date()).getTime() - items[key].getTime()) < ttl
    }
  }

  return that
}
