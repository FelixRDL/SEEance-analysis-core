exports.RepositoryLock = function () {
  const that = {}
  const locks = new Set([])

  that.isLocked = function (key) {
    return locks.has(key)
  }

  that.waitForUnlock = function (key) {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (!that.isLocked(key)) {
          resolve()
          clearTimeout(interval)
        }
      }, 100)
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
