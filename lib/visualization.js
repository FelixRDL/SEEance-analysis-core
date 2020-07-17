const pathLib = require('path')
const template = require('fs').readFileSync(pathLib.join(__dirname, 'visualization.template.html'), 'utf-8')

module.exports = function () {
  const that = {}

  // TODO: implement stuff

  /**
     * For mor information on how to plot, see Plotly Library
     * @param data Traces to display
     * @param layout Style info etc.
     * @param title: string
     */
  that.plot = function (data, layout, title = '') {
    const sData = JSON.stringify(data)
    const sLayout = JSON.stringify(layout)
    // sLayout.autosize = true
    return substitutePlaceholders(template, {
      data: sData,
      layout: sLayout,
      title: title
    })
  }

  function substitutePlaceholders (source, variableDict) {
    const vNames = Object.keys(variableDict)
    let rSource = source
    for (const vName of vNames) {
      rSource = rSource.replace(`\${${vName}}`, variableDict[vName])
    }
    return rSource
  }

  return that
}
