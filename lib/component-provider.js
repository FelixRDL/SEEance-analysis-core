const git = require('simple-git').gitP
const pathLib = require('path')
const fs = require('fs')
const rimraf = require('./promisified-rimraf')
const stdRepo = 'felixrdL/seeance-standard-components'
const exec = require('./promisify-exec').execShellCommand

/**
 *
 * @param {{
 *     customRepositories:[string],
 *     token: string,
 *     reloadOnly: boolean
 * }}options
 * @returns {Promise<{}>}
 * @constructor
 */
function ComponentProvider (options = {}) {
  const that = {}

  that.init = async function () {
    that.repositories = options.customRepositories ? [stdRepo].concat(options.customRepositories) : [stdRepo]
    that.componentsPath = pathLib.join(__dirname, '..', '.components')
    if (options.reloadOnly && options.reloadOnly === true) {
      await that.refresh()
    } else {
      await that.rebuild()
    }
  }

  /**
   * Load all plugins from scratch and delete any cached plugins.
   * @returns {Promise<void>}
   */
  that.rebuild = async function () {
    await rimraf(that.componentsPath)
    await Promise.all(that.repositories.map(async (repoUrl) => {
      const url = options.token ? `https://token:${options.token}@github.com/${repoUrl}` : `https://github.com/${repoUrl}`
      const targetPath = pathLib.join(that.componentsPath, makeFilenameSafe(repoUrl))
      await git().clone(url, targetPath)
      const components = getAllComponentsOfRepository(targetPath)
      for (let i = 0; i < components.length; i++) {
        const currComponent = components[i]
        console.log('COMPONENT PROVIDER:', '', `Installing Component (${i + 1}/${components.length}) from ${repoUrl}`, currComponent.name)
        await linkPackage(currComponent.path, currComponent.name)
      }
    }))
  }

  /**
   * Keep existing plugins and only install new plugins
   * @returns {Promise<void>}
   */
  that.refresh = async function () {
    await Promise.all(that.repositories.map(async (repoUrl) => {
      const targetPath = pathLib.join(that.componentsPath, makeFilenameSafe(repoUrl))
      const kownPlugins = (await exec('npm ls -g --depth=0 --link=true')).split('\n')
      await git().pull(targetPath)
      const components = getAllComponentsOfRepository(targetPath)
      for (let i = 0; i < components.length; i++) {
        const currComponent = components[i]
        if (!kownPlugins.reduce((a, p) => p.includes(currComponent.name) ? true : a, false)) {
          console.log('COMPONENT PROVIDER:', '', `Installing Component (${i + 1}/${components.length}) from ${repoUrl}`, currComponent.name)
          await linkPackage(currComponent.path, currComponent.name)
        } else {
          console.log('COMPONENT PROVIDER:', '', `Using pre-cached ${currComponent.name}`)
        }
      }
    }))
  }

  /**
     * @param name: string
     * @returns {Promise<{package: *, manifest: *, module: *}|undefined>}
     */
  that.getDatasourceByName = function (name) {
    return getComponent('datasources', name)
  }

  /**
     *
     * @param name: string
     * @returns {Promise<{package: *, manifest: *, module: *}|undefined>}
     */
  that.getPreprocessorByName = function (name) {
    return getComponent('preprocessors', name)
  }

  /**
     *
     * @param name: string
     * @returns {Promise<{package: *, manifest: *, module: *}|undefined>}
     */
  that.getAnalysisByName = function (name) {
    return getComponent('analyses', name)
  }

  that.listDatasources = function () {
    return listComponents('datasources')
  }

  that.listPreprocessors = function () {
    return listComponents('preprocessors')
  }

  that.listAnalyses = function () {
    return listComponents('analyses')
  }

  /**
     *
     * @param path
     * @returns {[{
     *     name: string,
     *     path: string
     * }]}
     */
  function getAllComponentsOfRepository (path) {
    const result = []

    const paths = [pathLib.join(path, 'datasources'), pathLib.join(path, 'preprocessors'), pathLib.join(path, 'analyses')]
    for (const p of paths) {
      if (fs.existsSync(p)) {
        for (const subfolder of getFoldersWithin(p)) {
          result.push({
            name: subfolder,
            path: pathLib.join(p, subfolder)
          })
        }
      }
    }
    return result
  }

  /**
     * Uses answer by Rich Apodaca and Slava Fomin II (https://stackoverflow.com/questions/8088795/installing-a-local-module-using-npm)
     */
  async function linkPackage (packageFldr, packageName) {
    const rootDir = pathLib.join(__dirname, '..')
    try {
      await exec(`cd ${packageFldr} && npm link && cd ${rootDir} && npm link ${packageName}`)
    } catch (e) {
      // As this error has to be expected, simply ignore it!
      if (!e.includes('No repository field')) {
        console.error(e)
      }
    }
  }

  /**
     * @param type: string ("datsources", "preprocessors", "analyses")
     * @param name: string
     */
  function getComponent (type, name) {
    for (const repoFolder of getFoldersWithin(that.componentsPath)) {
      if (fs.existsSync(pathLib.join(that.componentsPath, repoFolder, type))) {
        const subfolders = getFoldersWithin(pathLib.join(that.componentsPath, repoFolder, type))
        if (subfolders.includes(name)) {
          const targetFldr = pathLib.join(that.componentsPath, repoFolder, type, name)
          return loadComponent(targetFldr)
        }
      }
    }
    return undefined
  }

  /**
     * @param type: string ("datsources", "preprocessors", "analyses")
     */
  function listComponents (type) {
    const results = []
    for (const repoFolder of getFoldersWithin(that.componentsPath)) {
      if (fs.existsSync(pathLib.join(that.componentsPath, repoFolder, type))) {
        for (const componentFolder of getFoldersWithin(pathLib.join(that.componentsPath, repoFolder, type))) {
          const targetFldr = pathLib.join(that.componentsPath, repoFolder, type, componentFolder)
          // TODO: what to do, if plugins have same name?
          results.push(loadComponent(targetFldr))
        }
      }
    }
    return results
  }

  /**
     * Import a component from its folder.
     * @param targetFolder
     * @returns {{package: {
     *   seeance: {
     *     depends_on: [string]
     *   }
     * }, manifest: {
     *   depends_on: [string]
     * }, module: function}}
     */
  function loadComponent (targetFolder) {
    const pkg = JSON.parse(fs.readFileSync(pathLib.join(targetFolder, 'package.json'), 'utf-8'))
    if(fs.existsSync(pathLib.join(targetFolder, 'README.md'))) {
      pkg.description = fs.readFileSync(pathLib.join(targetFolder, 'README.md'), 'utf-8')
    }
    return {
      package: pkg,
      manifest: pkg.seeance,
      module: require(targetFolder)
    }
  }

  /**
     * Get all names of contained folders.
     * @param path: string
     * @returns {string[]}
     */
  function getFoldersWithin (path) {
    return fs.readdirSync(path).filter((p) => fs.lstatSync(pathLib.join(path, p)).isDirectory())
  }

  /**
     * Solution by Shalom Craimer (https://stackoverflow.com/questions/8485027/javascript-url-safe-filename-safe-string)
     * @param input: string
     * @returns {string}
     */
  function makeFilenameSafe (input) {
    return input.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  }

  return that
}

module.exports = ComponentProvider
