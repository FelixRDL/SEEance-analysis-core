const git = require('simple-git').gitP
const pathLib = require('path')
const fs = require('fs')
const Visualisation = require('./lib/visualization')
const Cache = require('./lib/cache').Cache
const RepositoryLock = require('./lib/lock').Lock
const localRepoPath = pathLib.join(__dirname, '.repos')
const cache = Cache()
const lock = RepositoryLock()
const Log = require('./lib/logger').Log
const log = Log()
const rimraf = require('rimraf')

const ComponentProvider = require('./lib/component-provider')
const Topicality = require('./lib/topicality').Topicality
const top = new Topicality()

module.exports.ComponentProvider = ComponentProvider

/**
 * Pre-Clone the repository on creation to save time
 * @param repoOwner
 * @param repoName
 * @param token
 * @returns {Promise<void>}
 */
module.exports.prepare = async function (repoOwner, repoName, token) {
  await checkoutRepository(getPath(repoOwner, repoName, token))
}
/**
 * Remove caches and clones
 * @param repoOwner
 * @param repoName
 * @param token
 * @returns {Promise<void>}
 */
module.exports.cleanup = async function (repoOwner, repoName) {
  const concatRepoName = `${repoOwner}/${repoName}`
  const keys = cache.keys().filter(k => k.startsWith(concatRepoName))
  keys.map(k => cache.delete(k))
  await clearRepository(pathLib.join(localRepoPath, repoName))
}

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
 */
module.exports.analyze = async function (repoOwner, repoName, datasources, preprocessors, analysis, token = undefined) {
  const unifiedDatasources = Array.from(new Set(datasources))
  const githubDatasources = unifiedDatasources.filter((ds) => ds.manifest.type.includes('github'))
  const gitDatasources = unifiedDatasources.filter((ds) => ds.manifest.type.endsWith('git'))
  const filteredPreprocessors = analysis.package.seeance.ignorePreprocessors ? preprocessors.filter((p) => !analysis.package.seeance.ignorePreprocessors.includes(p.package.name)) : preprocessors
  const remotePath = getPath(repoOwner, repoName, token)

  console.log('START', 'CHECKOUT')
  const repoPath = await checkoutRepository(remotePath)
  console.log('END', 'CHECKOUT')

  let input = await Promise.all(
    gitDatasources.map(async (ds) => {
      const concatRepoName = `${repoOwner}/${repoName}`
      const logName = `${analysis.package.name}:${concatRepoName}`
      const cacheName = `${concatRepoName}/${ds.package.name}`
      let result
      if (lock.isLocked(cacheName)) {
        log.log('LOCK', 'Waiting for unlock...')
        await log.logPromise('WAIT FOR UNLOCK', logName,
          lock.waitForUnlock(cacheName)
        )
      }
      if (cache.exists(cacheName)) {
        log.log('CACHE', 'Load Cache...' + cacheName)
        result = cache.load(cacheName)
      } else {
        try {
          lock.lock(cacheName, cacheName)
          result = await log.logPromise('EXECUTE GIT SOURCE', logName,
            ds.module(repoPath, token)
          )
        } catch (e) {
          console.error(e)
        } finally {
          lock.unlock(cacheName)
        }
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
        if (cache.exists(cacheName)) {
          result = cache.load(cacheName)
        } else {
          result = await ds.module(repoOwner, repoName, token)
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
  for (const preprocessor of filteredPreprocessors) {
    input = await log.logPromise('EXECUTE PREPROCESSOR', preprocessor.package.name,
      preprocessor.module(input, preprocessor.config || {})
    )
  }
  return await log.logPromise('EXECUTE ANALYSIS', analysis.package.name,
    analysis.module(input, analysis.config || {}, Visualisation())
  )
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

function getPath (repoOwner, repoName, token) {
  return token ? `https://token:${token}@github.com/${repoOwner}/${repoName}` : `https://github.com/${repoOwner}/${repoName}`
}

async function clearRepository (path) {
  if (lock.isLocked(path)) {
    await log.logPromise('CHECKOUT WAIT FOR UNLOCK', path,
      lock.waitForUnlock(path)
    )
  }
  return new Promise((resolve, reject) => {
    rimraf(path, {}, resolve)
  })
}

async function checkoutRepository (repoPath) {
  if (!fs.existsSync(localRepoPath)) { fs.mkdirSync(localRepoPath) }
  const localTarget = pathLib.join(localRepoPath, pathLib.basename(repoPath))

  if (lock.isLocked(repoPath)) {
    await log.logPromise('CHECKOUT WAIT FOR UNLOCK', repoPath,
      lock.waitForUnlock(repoPath)
    )
  }

  if (!(top.isFresh(localTarget) && fs.existsSync(localTarget))) {
    if (fs.existsSync(localTarget)) {
      lock.lock(repoPath, 'pull')
      try {
        await log.logPromise('PULLING', repoPath,
          git(localTarget).pull()
        )
      } finally {
        lock.unlock(repoPath)
      }
    } else {
      try {
        lock.lock(repoPath, 'clone')
        await log.logPromise('CLONING', repoPath,
          git().clone(repoPath, localTarget)
        )
      } finally {
        lock.unlock(repoPath)
      }
    }
    top.registerRefresh(localTarget)
  }

  return localTarget
}
