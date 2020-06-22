const ComponentProvider = require("./lib/component-provider");
var git = require("simple-git").gitP;
const pathLib = require("path");
const fs = require("fs");
const Visualisation = require("./lib/visualization");

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
module.exports.analyze = async function (repoOwner, repoName, preprocessors, analysis, token = undefined) {
    const rp = await ComponentProvider({
        token: token,
        customRepositories: ['felixrdl/seeance-test']
    });
    const datasourceNames = analysis.pkg.seeance.depends_on;
    // TODO: implement installing dependencies
    await rp.init();

    console.log(rp.listDatasources());


    // Acquire input data
    // TODO: implement caching
    var datasources = datasourceNames.map(ds => rp.getDatasourceByName(ds));

    const githubDatasources = datasources.filter((ds) => ds['manifest']['type'].includes('github'));
    const gitDatasources = datasources.filter((ds) => ds['manifest']['type'].endsWith('git'));
    const repoPath = await checkoutRepository(`https://github.com/${repoOwner}/${repoName}`);
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
    input = input.reduce(function(acc, curr) {
        acc[curr.package.name] = curr.result;
        return acc;
    }, {});

    // TODO: preprocessing

    return await analysis.module(input, analysis.config, Visualisation());
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