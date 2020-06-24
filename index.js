var git = require("simple-git").gitP;
const pathLib = require("path");
const fs = require("fs");
const Visualisation = require("./lib/visualization");
const ComponentProvider = require("./lib/component-provider");

module.exports.ComponentProvider = ComponentProvider;

/**
 *
 * @param repoOwner
 * @param repoName
 * @param preprocessors
 * @param {{
 *     pkg: Object,
 *     module: function
 *     config: Object
 * }} analysis
 * @param token
 * @returns {Promise<void>}
 *
 * TODO: remove pkg from signature and use manifest instead (also pass name in signature)
 * TODO: datasources should be passed in, insteads of being loaded
 */
module.exports.analyze = async function (repoOwner, repoName, datasources, preprocessors, analysis, token = undefined) {
    console.log(datasources);
    const githubDatasources = datasources.filter((ds) => ds['manifest']['type'].includes('github'));
    const gitDatasources = datasources.filter((ds) => ds['manifest']['type'].endsWith('git'));
    const repoPath = await checkoutRepository(`https://github.com/${repoOwner}/${repoName}`);

    // TODO: implement installing dependencies
    // Acquire input data
    // TODO: implement caching

    let input = await Promise.all(
        gitDatasources.map(async (ds) => {
            return {
                result: await ds.module(repoPath, token),
                manifest: ds.manifest,
                package: ds.package,
            }
        }).concat(
            githubDatasources.map(async (ds) => {
                return {
                    result: await ds.module(repoOwner, repoName, token),
                    manifest: ds.manifest,
                    package: ds.package
                }
            }))
    );
    // Convert input to dictionary
    input = input.reduce(function (acc, curr) {
        acc[curr.package.name] = curr.result;
        return acc;
    }, {});

    for(let preprocessor of preprocessors) {
        input = await preprocessor.module(input, preprocessor.config);
    }

    // TODO: preprocessing

    return await analysis.module(input, analysis.config, Visualisation());
}

module.exports.getDependencies = function (preprocessors, analysis) {
    const components = [analysis].concat(preprocessors);
    var depDict = components.map((c) => c.pkg.seeance.depends_on).reduce((acc, curr) => {
        for (let item of curr) {
            acc[item] = item;
        }
        return acc;
    }, {});
    return Object.keys(depDict);
}


async function checkoutRepository(path, token = undefined) {
    const localPath = pathLib.join(__dirname, '.repos');
    if (!fs.existsSync(localPath))
        fs.mkdirSync(localPath);
    const target = pathLib.join(localPath, pathLib.basename(path))
    if (fs.existsSync(target)) {
        await git(target).pull();
    } else {
        await git().clone(path, target);
    }
    return target;
}