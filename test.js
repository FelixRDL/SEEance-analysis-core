const core = require('./index');
const ComponentProvider = require("./lib/component-provider");

test();

async function test() {
    let rp = await ComponentProvider({
        customRepositories: ['felixrdl/seeance-test']
    });
    await rp.init();
    var dependencies = ['issues', 'milestones', 'git-authors'];
    var datasources = dependencies.map(ds => rp.getDatasourceByName(ds));

    core.analyze(process.argv[2], process.argv[3],
        datasources,
        [], {
        config: {},
        pkg: {
            seeance: {
                depends_on: ['issues', 'milestones', 'git-authors']
            }
        },
        module: async (input, config, visualisation) => {
            return "<h1>Sampleee</h1>"
        }
    }).then(result => {
        console.log(result);
    }, error => {
        console.error(error);
    })
}