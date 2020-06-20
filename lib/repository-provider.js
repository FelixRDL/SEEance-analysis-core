const git = require('simple-git').gitP;
const pathLib = require('path');
const fs = require('fs');
const rimraf = require('./promisifiedRimraf');

async function RepositoryProvider(token=undefined){
    let that = {};

    that.init = async function() {
        that.componentsPath = pathLib.join('.', '.components');
        // Clone components
        // TODO: this should also work with multiple repositories!
        await rimraf(that.componentsPath);
        await git().clone(`https://github.com/FelixRDL/seeance-standard-components/`, that.componentsPath);
    }

    that.getDatasourceByName = function(name) {
        if(fs.existsSync(pathLib.join(__dirname, '..', '.components', 'datasources', name))) {
            return require(pathLib.join(__dirname, '..', '.components', 'datasources', name));
        } else {
            throw Error(`Datasource with name ${name} is not existing!`)
        }
    }
    return that;
}

module.exports = RepositoryProvider;