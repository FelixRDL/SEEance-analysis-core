exports.RepositoryLock = function () {
  const that = {}
  const locks = new Set([])
  /**
   * Locking timeout in seconds
   * @type {number}
   */
  const LOCK_TIMEOUT = 60

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
    setTimeout(() => {
      console.error(`Resource ${key} exceeded timeout duration!`)
      that.unlock(key)
    }, LOCK_TIMEOUT)
  }

  that.unlock = function (key) {
    locks.delete(key)
  }

  return that
}
