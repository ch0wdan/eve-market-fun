var util = require('util');
var _ = require('underscore');
var conf = require(__dirname + '/config');
var logger = require('winston');
var prog = require('commander');

function main(argv) {
    prog.version('0.0.1')
        .option('-s, --silent', 'Silence informational output', false);

    prog.command('hello')
        .description('Say hello')
        .action(init(hello));

    prog.command('serve')
        .description('Start web app')
        .action(init(serve));

    prog.parse(argv);
}

function init (fn) {
    return function () {

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

        return fn();
    }
}

function serve () {
    require('./app')();
}

function hello () {
    logger.debug("HELLO");
}

exports.main = main;
