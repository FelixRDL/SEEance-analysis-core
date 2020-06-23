/**
 * Source: Ali Kamalizade (https://medium.com/@ali.dev/how-to-use-promise-with-exec-in-node-js-a39c4d7bbf77)
 */

/**
 * Executes a shell command and return it as a Promise.
 * @param cmd {string}
 * @return {Promise<string>}
 */
exports.execShellCommand = function(cmd) {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    });
}