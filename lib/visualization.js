const plotly = require('plotly');
module.exports = function() {
    var that = {};
    that.plotly = plotly;

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

    return that;
}

