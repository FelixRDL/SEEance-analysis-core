const core = require('./index');
const ComponentProvider = require("./lib/component-provider");

test();

async function test() {
    console.log("TEST: Getting Components...");
    let rp = await ComponentProvider({
        customRepositories: ['felixrdl/seeance-test']
    });
    let analysis = {
        config: {},
        pkg: {
            seeance: {
                depends_on: ['issues', 'milestones', 'git-authors', 'install-test']
            }
        },
        module: async (input, config, visualisation) => {
            console.log(input['install-test']);
            return visualisation.plot([{
                x: [0, 1, 2, 3, 4, 5, 6, 7, 8],
                y: [0, 3, 6, 4, 5, 2, 3, 5, 4],
                type: 'scatter'
            }], {}, "Some Plot");
        }
    };
    await rp.init();
    console.log("TEST: Loading Relevant Components...");
    var dependencies = core.getDependencies([], analysis);
    var datasources = await Promise.all(dependencies.map(ds => rp.getDatasourceByName(ds)));
    console.log("TEST: Exec Analysis...");
    core.analyze(process.argv[2], process.argv[3],
        datasources,
        [], analysis).then(result => {
        console.log(result);
    }, error => {
        console.error(error);
    });
}