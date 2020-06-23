const pathLib = require('path');
const template = require('fs').readFileSync(pathLib.join(__dirname, 'visualization.template.html'), 'utf-8');

module.exports = function() {
    var that = {};

    // TODO: implement stuff

    /**
     * @param {{
     *    title: string,
     *    points: {
     *        x: number,
     *        y: number
     *    }
     * }[]} plots
     */
    that.createLinePlot = function(plots) {
        throw(new Error("Method not yet implemented"));
    }

    /**
     * For mor information on how to plot, see Plotly Library
     * @param data Traces to display
     * @param layout Style info etc.
     */
    that.plot = function(data, layout, title="") {
        var sData = JSON.stringify(data);
        var sLayout = JSON.stringify(layout)
        return substitutePlaceholders(template, {
           'data': sData,
           'layout': sLayout,
           'title':  title
        });
    }

    function substitutePlaceholders(source, variableDict) {
        const vNames = Object.keys(variableDict);
        let rSource = source;
        for(let vName of vNames) {
            rSource = rSource.replace(`\${${vName}}`, variableDict[vName]);
        }
        return rSource;
    }

    return that;
}

