const git = require('simple-git').gitP;
const pathLib = require('path');
const fs = require('fs');
const rimraf = require('./promisified-rimraf');
const stdRepo = "FelixRDL/seeance-standard-components/";

/**
 *
 * @param {{
 *     customRepositories:[string],
 *     token: string
 * }}options
 * @returns {Promise<{}>}
 * @constructor
 */
async function ComponentProvider(options = {}) {
    let that = {};
    that.init = async function () {
        var repositories = options['customRepositories'] ? [stdRepo].concat(options['customRepositories']) : [stdRepo];
        that.componentsPath = pathLib.join('.', '.components');
        await rimraf(that.componentsPath);
        await Promise.all(repositories.map((async (repoUrl) => {
            const url = options['token'] ? `https://token:${options['token']}@github.com/${repoUrl}` : `https://github.com/${repoUrl}`;
            const targetPath = pathLib.join(that.componentsPath, makeFilenameSafe(repoUrl));
            await git().clone(url, targetPath);
            // TODO: install dependencies
        })))
    }

    that.getDatasourceByName = function (name) {
        return getComponent('datasources', name);
    }

    that.getPreprocessorByName = function (name) {
        return getComponent('preprocessors', name);
    }

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
     * @param type: string ("datsources", "preprocessors", "analyses")
     * @param name: string
     */
    function getComponent(type, name) {
        for (let repoFolder of getFoldersWithin(that.componentsPath)) {
            if (fs.existsSync(pathLib.join(that.componentsPath, repoFolder, type))) {
                const subfolders = getFoldersWithin(pathLib.join(that.componentsPath, repoFolder, type));
                if (subfolders.includes(name)) {
                    const targetFldr = pathLib.join(__dirname, '..', that.componentsPath, repoFolder, type, name);
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
                    const targetFldr = pathLib.join(__dirname, '..', that.componentsPath, repoFolder, type, componentFolder);
                    // TODO: what to do, if plugins have same name?
                    results.push(loadComponent(targetFldr));
                }
            }
        }
        return results;
    }

    function loadComponent(targetFolder) {
        const pkg = JSON.parse(fs.readFileSync(pathLib.join(targetFolder, 'package.json'), 'utf-8'));
        return {
            package: pkg,
            manifest: pkg['seeance'],
            module: require(targetFolder)
        }
    }

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