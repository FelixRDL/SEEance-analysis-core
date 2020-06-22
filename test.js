const core = require('./index');
const ComponentProvider = require("./lib/component-provider");

test();

async function test() {
    let rp = await ComponentProvider({
        customRepositories: ['felixrdl/seeance-test']
    });
    let analysis = {
        config: {},
        pkg: {
            seeance: {
                depends_on: ['issues', 'milestones', 'git-authors']
            }
        },
        module: async (input, config, visualisation) => {
            return "<h1>Sampleee</h1>"
        }
    };
    await rp.init();
    var dependencies = core.getDependencies([], analysis);
    var datasources = dependencies.map(ds => rp.getDatasourceByName(ds));
    core.analyze(process.argv[2], process.argv[3],
        datasources,
        [], analysis).then(result => {
        console.log(result);
    }, error => {
        console.error(error);
    });
}