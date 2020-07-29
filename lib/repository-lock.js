exports.RepositoryLock = function () {
  const that = {}
  const locks = new Set([])
  const timeoutIds = {}
  /**
   * Locking timeout in seconds
   * @type {number}
   */
  const LOCK_TIMEOUT = 500

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

  that.lock = function (key, requestor = undefined) {
    locks.add(key)
    console.log(requestor || 'unknown', 'has locked', key)
    timeoutIds[key] = setTimeout(() => {
      console.error(`Resource ${key} exceeded timeout duration!`)
      that.unlock(key)
    }, LOCK_TIMEOUT * 1000)
  }

  that.unlock = function (key) {
    clearTimeout(timeoutIds[key])
    delete timeoutIds[key]
    locks.delete(key)
  }

  return that
}
