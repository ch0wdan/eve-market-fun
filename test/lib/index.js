var util = require('util');
var logger = require('winston');
var Promise = require('bluebird');

var conf = require(__dirname + '/../../lib/config');
var models = require(__dirname + '/../../lib/models');

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

exports.setupUsers = function () {
    var user = models.User.forge({
        username: 'traderjoe',
        email: 'traderjoe@example.com'
    });
    return user.fetch().then(function (found) {
        return found ? found :
            user.hashPassword('traderjoe').save();
    });
}
