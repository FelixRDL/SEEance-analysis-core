const git = require('simple-git').gitP
const pathLib = require('path')
const fs = require('fs')
const Visualisation = require('./lib/visualization')
const Cache = require('./lib/cache').Cache
const RepositoryLock = require('./lib/repository-lock').RepositoryLock
const cache = Cache()
const lock = RepositoryLock()
const Log = require('./lib/logger').Log
const log = Log()

const ComponentProvider = require('./lib/component-provider')

module.exports.ComponentProvider = ComponentProvider

/**
 *
 * @param repoOwner
 * @param repoName
 * @param {[{
 *     package: Object,
 *     module: function,
 *     manifest: Object
 * }]} datasources
 * @param {[{
 *     package: Object,
 *     module: function
 *     config: Object
 * }]} preprocessors
 * @param {{
 *     package: Object,
 *     module: function
 *     config: Object
 * }} analysis
 * @param token
 * @returns {Promise<void>}
 *
 * TODO: remove pkg from signature and use manifest instead (also pass name in signature)
 */
module.exports.analyze = async function (repoOwner, repoName, datasources, preprocessors, analysis, token = undefined) {
  const githubDatasources = datasources.filter((ds) => ds.manifest.type.includes('github'))
  const gitDatasources = datasources.filter((ds) => ds.manifest.type.endsWith('git'))
  const remotePath = token ? `https://token:${token}@github.com/${repoOwner}/${repoName}`
    : `https://github.com/${repoOwner}/${repoName}`
  const repoPath = await checkoutRepository(remotePath)

  let input = await Promise.all(
    gitDatasources.map(async (ds) => {
      const concatRepoName = `${repoOwner}/${repoName}`
      const logName = `${analysis.package.name}:${concatRepoName}`
      const cacheName = `${concatRepoName}/${ds.package.name}`
      let result
      if (lock.isLocked(concatRepoName)) {
        log.log(ds.package.name, `Waiting for ${analysis.package.name}:${concatRepoName} to unlock`)
        log.startTimer(`unlock_${logName}`)
        await lock.waitForUnlock(concatRepoName)
        log.startTimer(`unlock_${logName}`)
      }

      if (cache.exists(cacheName)) {
        log.log(ds.package.name, `Loading git datasource  ${analysis.package.name}:${cacheName} from cache`)
        log.startTimer(`cacheload_${logName}`)
        result = cache.load(cacheName)
        log.stopTimer(`cacheload_${logName}`)
      } else {
        try {
          lock.lock(concatRepoName)
          log.log(ds.package.name, `Fetch git datasource  ${analysis.package.name}:${cacheName}`)
          log.startTimer(`exec_${logName}`)
          result = await ds.module(repoPath, token)
        } finally {
          lock.unlock(concatRepoName)
          log.stopTimer(`exec_${logName}`)
        }
        // TODO: make caching configurable via analysis (--no-cache)
        cache.store(cacheName, result, ds.manifest.ttl || 6000)
      }
      return {
        result: result,
        manifest: ds.manifest,
        package: ds.package
      }
    }).concat(
      githubDatasources.map(async (ds) => {
        const cacheName = `${repoOwner}/${repoName}/${ds.package.name}`
        let result
        // TODO: also cache git analyses!
        if (cache.exists(cacheName)) {
          result = cache.load(cacheName)
        } else {
          result = await ds.module(repoOwner, repoName, token)
          // TODO: make caching configurable via analysis (--no-cache)
          cache.store(cacheName, result, ds.manifest.ttl || 6000)
        }
        return {
          result: result,
          manifest: ds.manifest,
          package: ds.package
        }
      }))
  )
  // Convert input to dictionary
  input = input.reduce(function (acc, curr) {
    acc[curr.package.name] = curr.result
    return acc
  }, {})
  for (const preprocessor of preprocessors) {
    input = await preprocessor.module(input, preprocessor.config)
  }
  return await analysis.module(input, analysis.config, Visualisation())
}

/**
 *
 * @param {[{
 *     package: Object,
 *     module: function
 *     config: Object
 * }]} preprocessors
 * @param {{
 *     package: {
 *       seeance: {
 *         depends_on: [string]
 *       }
 *     },
 *     module: function
 *     config: Object
 * }} analysis
 * @returns {string[]}
 */
module.exports.getDependencies = function (preprocessors, analysis) {
  const components = [analysis].concat(preprocessors)
  const depDict = components.map((c) => c.package.seeance.depends_on).reduce((acc, curr) => {
    for (const item of curr) {
      acc[item] = item
    }
    return acc
  }, {})
  return Object.keys(depDict)
}

async function checkoutRepository (path) {
  const logKey = `${path}_${new Date().getMilliseconds()}`
  if (lock.isLocked(path)) {
    log.log('Checkout', `Waiting for unlocking ${path}`)
    log.startTimer(`checkout_${logKey}`)
    await lock.waitForUnlock(path)
    log.stopTimer(`checkout_${logKey}`)
  }
  lock.lock(path)
  const localPath = pathLib.join(__dirname, '.repos')
  if (!fs.existsSync(localPath)) { fs.mkdirSync(localPath) }
  const target = pathLib.join(localPath, pathLib.basename(path))
  if (fs.existsSync(target)) {
    log.log('Pull', `Pulling ${path}`)
    log.startTimer(`pull_${logKey}`)
    await git(target).pull()
    log.stopTimer(`pull_${logKey}`)
  } else {
    try {
      log.log('Clone', `Cloning ${path}`)
      log.startTimer(`clone_${logKey}`)
      await git().clone(path, target)
    } catch (e) {
      console.error(e)
    } finally {
      lock.unlock(path)
      log.stopTimer(`clone_${logKey}`)
    }
  }

  return target
}
