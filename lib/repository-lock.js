exports.RepositoryLock = function () {
  const that = {}
  const locks = new Set([])

  that.isLocked = function (key) {
    return locks.has(key)
  }

  that.waitForUnlock = function (key) {
    return new Promise((resolve, reject) => {
      const interval = setInterval((key, resolve) => {
        if (!that.isLocked(key)) {
          clearTimeout(interval)
          resolve()
        }
      }, 100, key, resolve)
    })
  }

  that.lock = function (key) {
    locks.add(key)
  }

  that.unlock = function (key) {
    locks.delete(key)
  }

  return that
}
