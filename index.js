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
      if (lock.isLocked(cacheName)) {
        log.log('LOCK', 'Waiting for unlock...')
        await log.logPromise('WAIT FOR UNLOCK', logName,
          lock.waitForUnlock(cacheName)
        )
      }
      if (cache.exists(cacheName)) {
        log.log('CACHE', 'Load Cache...')
        result = cache.load(cacheName)
      } else {
        try {
          lock.lock(cacheName)
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
  for (const preprocessor of preprocessors) {
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

async function checkoutRepository (path) {
  const localPath = pathLib.join(__dirname, '.repos')
  if (lock.isLocked(path)) {
    await log.logPromise('CHECKOUT WAIT FOR UNLOCK', path,
      lock.waitForUnlock(path)
    )
  }
  if (!fs.existsSync(localPath)) { fs.mkdirSync(localPath) }
  const target = pathLib.join(localPath, pathLib.basename(path))
  if (fs.existsSync(target)) {
    lock.lock(path)
    try {
      await log.logPromise('PULLING', path,
        git(target).pull()
      )
    } finally {
      lock.unlock(path)
    }
  } else {
    try {
      lock.lock(path)
      await log.logPromise('CLONING', path,
        git().clone(path, target)
      )
    } finally {
      lock.unlock(path)
    }
  }
  return target
}
