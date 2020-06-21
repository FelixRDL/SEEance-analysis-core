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
async function ComponentProvider(options= {}){
    let that = {};
    that.init = async function() {
        var repositories = options['customRepositories'] ? [stdRepo].concat(options['customRepositories']):[stdRepo];
        that.componentsPath = pathLib.join('.', '.components');
        await rimraf(that.componentsPath);
        await Promise.all(repositories.map((async(repoUrl) => {
            const url = options['token'] ? `https://token:${options['token']}@github.com/${repoUrl}`: `https://github.com/${repoUrl}`;
            await git().clone(url, pathLib.join(that.componentsPath, makeFilenameSafe(repoUrl)));
        })))
    }

    /**
     * @param name: string
     * @returns {Promise<Datasource>}
     */
    that.getDatasourceByName = function(name) {
        return getComponent('datasources', name);
    }

    /**
     *
     * @param which: string ("datsources", "preprocessors", "analyses")
     * @param name: string
     */
    function getComponent(which, name) {
        for(let repoFolder of getFoldersWithin(that.componentsPath)) {
        const subfolders = getFoldersWithin(pathLib.join(that.componentsPath, repoFolder, which));
        if(subfolders.includes(name)) {
            const targetFldr = pathLib.join(__dirname, '..', that.componentsPath, repoFolder, which, name);
            const pkg = JSON.parse(fs.readFileSync(pathLib.join(targetFldr, 'package.json'), 'utf-8'));
            return {
                package: pkg,
                manifest: pkg['seeance'],
                module: require(targetFldr)
            }
        }
    }
        throw Error(`Compeont with name ${name} was not found!`);
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