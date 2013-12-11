var util = require('util');

var _ = require('underscore');
var conf = require(__dirname + '/config');
var logger = require('winston');
var prog = require('commander');

var Knex = require('knex');
var Bookshelf = require('bookshelf');

function main(argv) {
    prog.version('0.0.1')
        .option('-s, --silent', 'Silence informational output', false);

    prog.command('serve')
        .description('Start web app')
        .action(init(serve));

    prog.command('adduser')
        .description('Create a user account')
        .action(init(adduser));

    prog.command('items')
        .action(init(items));

    prog.parse(argv);
}

var db_Main, db_EVE;

function init (fn) {
    return function () {
        var $this = this;
        var $arguments = arguments;

        if (prog.silent) { conf.set('silent', true); }

        // Set up logging
        logger.remove(logger.transports.Console);
        if (!conf.get('silent')) {
            logger.padLevels = true;
            logger.add(logger.transports.Console, {
                level: 'silly', colorize: true
            });
        }

        // see: https://github.com/flatiron/logger/issues/89
        logger.setLevels({silly: 0, verbose: 1, debug: 2,
                           info: 3, warn: 4, error: 5});

        db_Main = Knex.initialize(conf.get('database'));
        db_EVE = Knex.initialize(conf.get('database_eve_static'));

        return fn.apply($this, $arguments);
    }
}

function serve () {
    require('./app')();
}

function adduser (username, password) {
    logger.debug("USER " + username + " PASS " + password);
}

function items () {
    db_EVE('invTypes')
        .select()
        .limit(10)
        .then(function (rows) {
            logger.info("ROWS " + util.inspect(rows));
            process.exit();
        });
}

exports.main = main;
