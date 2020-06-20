const rimraf = require('rimraf');

module.exports = async function(target) {
    return new Promise((resolve, reject) => {
       rimraf(target, () => {
           resolve();
       });
    });
}