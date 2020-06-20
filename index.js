const ComponentProvider = require("./lib/repository-provider")

module.exports = async function(repoOwner, repoName, preprocessors, analyses, token=undefined) {
    const rp = await ComponentProvider(token);
    await rp.init();

    const issues = await rp.getDatasourceByName('issues')(repoOwner, repoName);
    const milestones = await rp.getDatasourceByName('milestones')(repoOwner, repoName);
    console.log(issues);
    console.log(milestones);
}