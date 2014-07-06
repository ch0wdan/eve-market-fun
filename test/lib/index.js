var util = require('util');
var logger = require('winston');

var conf = require(__dirname + '/../../lib/config');

exports.migrateDB = function () {
    return conf.db_Main.migrate.latest({
        directory: __dirname + '/../../migrations',
        database: conf.db_Main
    });
    /*
    spread(function (batchNo, log) {
        if (log.length === 0) {
            util.debug('Already up to date'.cyan);
        } else {
            util.debug(('Batch ' + batchNo + ' run: ' + 
                    log.length + ' migrations \n').green +
                log.join('\n').cyan);
        }
    });
    */
}
