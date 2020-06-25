const http = require('http');
const core = require('./index');
const ComponentProvider = require("./lib/component-provider");

test().then(() => {
    test({
        isServingResults: true
    });
});

async function test(options = {}) {
    console.log("TEST: Lpading Components...");
    let rp = await ComponentProvider({
        customRepositories: ['felixrdl/seeance-test']
    });
    await rp.init();

    console.log("TEST: Loading Relevant Components...");
    const analysis = await rp.getAnalysisByName('test-joke');
    const preprocessor = await rp.getPreprocessorByName('testpp');
    var dependencies = core.getDependencies(preprocessor, analysis);
    var datasources = await Promise.all(dependencies.map(ds => rp.getDatasourceByName(ds)));

    console.log("TEST: Exec Analysis...");
    var result = await core.analyze(process.argv[2], process.argv[3],
        datasources,
        [{
            module: preprocessor.module,
            package: preprocessor.package,
            config: {}
        }], {
            module: analysis.module,
            pacakge: analysis.package,
            config: {}
        });

    // Solution by stackoverflow user JLeXanDR
    // (https://stackoverflow.com/questions/35995273/how-to-run-html-file-using-node-js)
    if (options.isServingResults) {
        console.log("TEST: Serving analysis output on http://localhost:8080")
        http.createServer(function (request, response) {
            response.writeHeader(200, {"Content-Type": "text/html"});
            response.write(result);
            response.end();
        }).listen(8080);
    }
}