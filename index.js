const git = require('simple-git').gitP
const pathLib = require('path')
const fs = require('fs')
const Visualisation = require('./lib/visualization')
const Cache = require('./lib/cache').Cache
const cache = Cache()

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

  // TODO: implement installing dependencies

  let input = await Promise.all(
    gitDatasources.map(async (ds) => {
      return {
        result: await ds.module(repoPath, token),
        manifest: ds.manifest,
        package: ds.package
      }
    }).concat(
      githubDatasources.map(async (ds) => {
        const name = ds.package.name
        let result
        // TODO: also cache git analyses!
        if (cache.exists(name)) {
          result = cache.load(name)
        } else {
          result = await ds.module(repoOwner, repoName, token)
          // TODO: make caching configurable via analysis (--no-cache)
          cache.store(name, result, ds.manifest.ttl || 6000)
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
  const localPath = pathLib.join(__dirname, '.repos')
  if (!fs.existsSync(localPath)) { fs.mkdirSync(localPath) }
  const target = pathLib.join(localPath, pathLib.basename(path))
  if (fs.existsSync(target)) {
    await git(target).pull()
  } else {
    await git().clone(path, target)
  }
  return target
}
