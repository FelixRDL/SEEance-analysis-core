const core = require('./index');

core.analyze(process.argv[2], process.argv[3], [], {
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