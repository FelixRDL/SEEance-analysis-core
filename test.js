const core = require('./index');

core(process.argv[2], process.argv[3]).then(result => {
    console.log(result);
}, error => {
    console.error(error);
})