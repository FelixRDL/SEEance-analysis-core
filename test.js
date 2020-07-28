const http = require('http')
const core = require('./index')
const ComponentProvider = require('./lib/component-provider')
const rimraf = require('rimraf')
const fs = require('fs')
const repoFolder = './.repos'
let rp
const log = require('./lib/logger').Log()

process.env.SEEANCE_LOG = true

if (fs.existsSync(repoFolder)) {
  rimraf.sync(repoFolder)
  fs.mkdirSync(repoFolder)
}

main().then(() => {
  console.log('Test executed successfully')
  process.exit(0)
})

async function main () {
  rp = ComponentProvider({
    customRepositories: [],
    reloadOnly: false,
    onlyLoad: [
      'activity-over-time',
      'remove-outliers'
    ]
  })
  await log.logPromise('INIT', 'Plugin Provider', rp.init())

  await testConcurrentBig()

  await core.cleanup('esolneman', 'oop-helper-handout-plugin')

  await log.logPromise('TEST', 'repo A 1st run', testCloneBigRepositoryA({ isServingResults: false }))
  await log.logPromise('TEST', 'repo A 2nd run', testCloneBigRepositoryA({ isServingResults: false }))
}

async function testConcurrentBig (options = {}) {
  return Promise.all([
    log.logPromise('TEST', 'repo A 1st run', testCloneBigRepositoryA({ isServingResults: false })),
    log.logPromise('TEST', 'repo A 2nd run', testCloneBigRepositoryA({ isServingResults: false }))
  ])
}

async function testCloneBigRepositoryA (options = {}) {
  return test('esolneman', 'oop-helper-handout-plugin', 'activity-over-time', 'remove-outliers', options)
}

async function test (repoOwner, repoName, analysisName, preprocessorName, options) {
  console.log('TEST: Loading Components...')
  console.log('TEST: Loading Relevant Components...')
  const analysis = await rp.getAnalysisByName(analysisName)
  const preprocessor = preprocessorName ? await rp.getPreprocessorByName(preprocessorName) : undefined
  const dependencies = core.getDependencies(preprocessor || [], analysis)
  const datasources = await Promise.all(dependencies.map(ds => rp.getDatasourceByName(ds)))

  console.log('TEST: Exec Analysis...', analysisName)
  const result = await core.analyze(repoOwner, repoName,
    datasources,
    preprocessor ? [{
      module: preprocessor.module,
      package: preprocessor.package,
      config: {}
    }] : [], {
      module: analysis.module,
      package: analysis.package,
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
