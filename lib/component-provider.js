const git = require('simple-git').gitP;
const pathLib = require('path');
const fs = require('fs');
const rimraf = require('./promisified-rimraf');
const stdRepo = "felixrdL/seeance-standard-components";
const exec = require('./promisify-exec').execShellCommand;

/**
 *
 * @param {{
 *     customRepositories:[string],
 *     token: string
 * }}options
 * @returns {Promise<{}>}
 * @constructor
 */
function ComponentProvider(options = {}) {
    let that = {};

    that.init = async function () {
        that.repositories = options['customRepositories'] ? [stdRepo].concat(options['customRepositories']) : [stdRepo];
        that.componentsPath = pathLib.join(__dirname, '..', '.components');
        await that.refresh();
    }

    that.refresh = async function() {
        await rimraf(that.componentsPath);
        await Promise.all(that.repositories.map((async (repoUrl) => {
            const url = options['token'] ? `https://token:${options['token']}@github.com/${repoUrl}` : `https://github.com/${repoUrl}`;
            const targetPath = pathLib.join(that.componentsPath, makeFilenameSafe(repoUrl));
            await git().clone(url, targetPath);
            const components = getAllComponentsOfRepository(targetPath)
            for(let i = 0; i < components.length; i++) {
                let currComponent = components[i];
                console.log("COMPONENT PROVIDER:", "" ,`Installing Component (${i+1}/${components.length}) from ${repoUrl}`, currComponent.name)
                await linkPackage(currComponent.path, currComponent.name);
            }
        })));
    }

    /**
     * @param name: string
     * @returns {Promise<{package: *, manifest: *, module: *}|undefined>}
     */
    that.getDatasourceByName = function (name) {
        return getComponent('datasources', name);
    }

    /**
     *
     * @param name: string
     * @returns {Promise<{package: *, manifest: *, module: *}|undefined>}
     */
    that.getPreprocessorByName = function (name) {
        return getComponent('preprocessors', name);
    }

    /**
     *
     * @param name: string
     * @returns {Promise<{package: *, manifest: *, module: *}|undefined>}
     */
    that.getAnalysisByName = function (name) {
        return getComponent('analyses', name);
    }

    that.listDatasources = function () {
        return listComponents('datasources');
    }

    that.listPreprocessors = function () {
        return listComponents('preprocessors');
    }

    that.listAnalyses = function () {
        return listComponents('analyses');
    }

    /**
     *
     * @param path
     * @returns {[{
     *     name: string,
     *     path: string
     * }]}
     */
    function getAllComponentsOfRepository(path) {
        var result = []

        var paths = [pathLib.join(path, 'datasources'), pathLib.join(path, 'preprocessors'), pathLib.join(path, 'analyses')];
        for (let p of paths) {
            if (fs.existsSync(p)) {
                for (let subfolder of getFoldersWithin(p)) {
                    result.push({
                        name: subfolder,
                        path: pathLib.join(p, subfolder)
                    });
                }
            }
        }
        return result;
    }

    /**
     * Uses answer by Rich Apodaca and Slava Fomin II (https://stackoverflow.com/questions/8088795/installing-a-local-module-using-npm)
     */
    async function linkPackage(packageFldr, packageName) {
        const rootDir = pathLib.join(__dirname, '..');
        await exec(`cd ${packageFldr} && npm link && cd ${rootDir} && npm link ${packageName}`);
    }

    /**
     * @param type: string ("datsources", "preprocessors", "analyses")
     * @param name: string
     */
    async function getComponent(type, name) {
        for (let repoFolder of getFoldersWithin(that.componentsPath)) {
            if (fs.existsSync(pathLib.join(that.componentsPath, repoFolder, type))) {
                const subfolders = getFoldersWithin(pathLib.join(that.componentsPath, repoFolder, type));
                if (subfolders.includes(name)) {
                    const targetFldr = pathLib.join(that.componentsPath, repoFolder, type, name);
                    return loadComponent(targetFldr);
                }
            }
        }
        throw Error(`Component with name ${name} was not found!`);
    }

    /**
     * @param type: string ("datsources", "preprocessors", "analyses")
     */
    function listComponents(type) {
        const results = [];
        for (let repoFolder of getFoldersWithin(that.componentsPath)) {
            if (fs.existsSync(pathLib.join(that.componentsPath, repoFolder, type))) {
                for (let componentFolder of getFoldersWithin(pathLib.join(that.componentsPath, repoFolder, type))) {
                    const targetFldr = pathLib.join(that.componentsPath, repoFolder, type, componentFolder);
                    // TODO: what to do, if plugins have same name?
                    results.push(loadComponent(targetFldr));
                }
            }
        }
        return results;
    }

    /**
     * Import a component from its folder.
     * @param targetFolder
     * @returns {{package: any, manifest: *, module: any}}
     */
    function loadComponent(targetFolder) {
        const pkg = JSON.parse(fs.readFileSync(pathLib.join(targetFolder, 'package.json'), 'utf-8'));
        return {
            package: pkg,
            manifest: pkg['seeance'],
            module: require(targetFolder)
        }
    }

    /**
     * Get all names of contained folders.
     * @param path: string
     * @returns {string[]}
     */
    function getFoldersWithin(path) {
        return fs.readdirSync(path).filter((p) => fs.lstatSync(pathLib.join(path, p)).isDirectory());
    }

    /**
     * Solution by Shalom Craimer (https://stackoverflow.com/questions/8485027/javascript-url-safe-filename-safe-string)
     * @param input: string
     * @returns {string}
     */
    function makeFilenameSafe(input) {
        return input.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    return that;
}

module.exports = ComponentProvider;