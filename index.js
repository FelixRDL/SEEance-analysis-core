const ComponentProvider = require("./lib/repository-provider");
var git = require("simple-git").gitP;
const pathLib = require("path");
const fs = require("fs");

module.exports = async function(repoOwner, repoName, preprocessors, analyses, token=undefined) {
    const rp = await ComponentProvider(token);
    const datasourceNames = ['issues', 'milestones', 'git-authors'];

    // TODO: implement installing dependencies
    await rp.init();

    // Acquire input data
    // TODO: implement caching
    var datasources = datasourceNames.map(ds => rp.getDatasourceByName(ds));

    const githubDatasources = datasources.filter((ds) => ds['manifest']['type'].includes('github'));
    const gitDatasources = datasources.filter((ds) => !ds['manifest']['type'].includes('git'));

    const input = await Promise.all(
        githubDatasources.map((ds) => ds.module(repoOwner, repoName, token)),
        getRepository(`https://github.com/${repoOwner}/${repoName}`).then((path) => {
            return gitDatasources.map((ds) => ds.module(path, token));
        })
    );

    // TODO: preprocessing

    // TODO: execute analysis
}


async function getRepository(path, token=undefined) {
    const localPath = pathLib.join(__dirname, '.repos');
    if(!fs.existsSync(localPath))
        fs.mkdirSync(localPath);
    const target = pathLib.join(localPath, pathLib.basename(path))
    if(fs.existsSync(target)) {
        await git(target).pull();
    } else {
        await git().clone(path, target);
    }
    return target;
}