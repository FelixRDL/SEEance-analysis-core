exports.Log = function () {
  const that = {}
  const timers = {}

  function isLogging () {
    return process.env.SEEANCE_LOG && process.env.SEEANCE_LOG === 'true'
  }

  function millis () {
    return new Date().getTime()
  }

  that.log = function (prefix, message) {
    if (isLogging()) {
      console.log(prefix.toUpperCase(), message)
    }
  }

  that.startTimer = function (forKey) {
    that.log('STARTING_TIMER', forKey)
    timers[forKey] = millis()
  }

  that.stopTimer = function (forKey) {
    const startT = timers[forKey]
    const deltaT = (millis() - startT) / 1000.0
    that.log('TICK', `Finished Process ${forKey} in ${deltaT} seconds.`)
    delete timers[forKey]
  }

  that.logPromise = async function (tag, forKey, promise) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const pid = `${tag}:${forKey}_${new Date().getTime()}`
      let result
      try {
        that.startTimer(pid)
        result = await promise
        that.stopTimer(pid)
        resolve(result)
      } catch (e) {
        that.stopTimer(pid)
        reject(e)
      }
    })
  }

  return that
}
