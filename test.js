const http = require('http')
const core = require('./index')
const ComponentProvider = require('./lib/component-provider')

let rp

main().then(() => {
  console.log('Test executed successfully')
})

async function main () {
  rp = ComponentProvider({
    customRepositories: ['felixrdl/seeance-test']
  })
  await rp.init()
  const r1 = await testInstallDependencies({
    isServingResults: false
  })
  const r2 = await testInstallDependencies({
    isServingResults: false
  })
  console.log(r1, r2)

  await testGraphical({
    isServingResults: process.argv.includes('--host')
  })
}

async function testGraphical (options = {}) {
  return test('issues-by-member', undefined, options)
}

async function testInstallDependencies (options = {}) {
  return test('test-joke', 'testpp', options)
}

async function test (analysisName, preprocessorName, options) {
  console.log('TEST: Loading Components...')
  console.log('TEST: Loading Relevant Components...')
  const analysis = await rp.getAnalysisByName(analysisName)
  const preprocessor = preprocessorName ? await rp.getPreprocessorByName(preprocessorName) : undefined
  const dependencies = core.getDependencies(preprocessor || [], analysis)
  const datasources = await Promise.all(dependencies.map(ds => rp.getDatasourceByName(ds)))

  console.log('TEST: Exec Analysis...')
  const result = await core.analyze(process.argv[2], process.argv[3],
    datasources,
    preprocessor ? [{
      module: preprocessor.module,
      package: preprocessor.package,
      config: {}
    }] : [], {
      module: analysis.module,
      pacakge: analysis.package,
      config: {}
    })

  // Solution by stackoverflow user JLeXanDR
  // (https://stackoverflow.com/questions/35995273/how-to-run-html-file-using-node-js)
  if (options.isServingResults && options.isServingResults === true) {
    console.log('TEST: Serving analysis output on http://localhost:8080')
    http.createServer(function (request, response) {
      response.writeHeader(200, { 'Content-Type': 'text/html' })
      response.write(result)
      response.end()
    }).listen(8080)
  }

  return result
}