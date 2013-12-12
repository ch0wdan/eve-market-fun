var util = require('util');

var _ = require('underscore');
var conf = require(__dirname + '/config');
var logger = require('winston');
var prog = require('commander');

var Knex = require('knex');
var Bookshelf = require('bookshelf');

prog.version('0.0.1')
    .option('-s, --silent', 'Silence informational output', false);

module.exports = function (argv) {
    // HACK: Force --help, if no arguments supplied at all.
    if (argv.length == 2) { argv.push('--help'); }
    prog.parse(argv);
}

var db_Main, db_EVE, knex_config;

function init (fn) {
    return function () {
        var $this = this;
        var $arguments = Array.prototype.slice.apply(arguments);

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
        logger.setLevels({
            silly: 0, verbose: 1, debug: 2,
            info: 3, warn: 4, error: 5
        });

        db_Main = Knex.initialize(conf.get('database'));
        db_EVE = Knex.initialize(conf.get('database_eve_static'));

        knex_config = {
            directory: __dirname + '/../migrations',
            database: db_Main
        };

        return fn.apply($this, $arguments);
    }
}

var logError = function(err) {
    console.log(err.stack);
};

var err = function(msg) {
    console.log(msg.red);
    process.exit();
};

var exit = function() {
    db_Main.client.pool.destroy();
    process.exit();
};

prog.command('serve')
    .description('Start web app')
    .action(init(require('./app')));

prog.command('adduser <username> <password>')
    .description('Create a user account')
    .action(init(function (username, password) {
        db_Main('Users')
        logger.debug("USER " + username + " PASS " + password);
    }));

prog.command('items')
    .action(init(function () {
        db_EVE('invTypes')
            .select()
            .limit(10)
            .then(function (rows) {
                logger.info("ROWS " + util.inspect(rows));
            })
            .finally(exit);
    }));

prog.command('stream-emdr')
    .action(init(function () {
        var util = require('util');
        var zmq = require('zmq');
        var zlib = require('zlib');

        var sock = zmq.socket('sub');

        // Connect to the first publicly available relay.
        sock.connect('tcp://relay-us-central-1.eve-emdr.com:8050');
        // Disable filtering
        sock.subscribe('');

        sock.on('message', function(msg){
            // Receive raw market JSON strings.
            zlib.inflate(msg, function(err, market_json) {
                // Un-serialize the JSON data.
                var market_data = JSON.parse(market_json);

                // Do something useful
                console.log(market_data);
            });
        });
    }));

prog.command('migrate:latest')
    .description('Upgrade the database to the latest migration')
    .action(init(function () {
        db_Main.migrate.latest(knex_config)
            .spread(function(batchNo, log) {
                if (log.length === 0) {
                    console.log('Already up to date'.cyan);
                } else {
                    console.log(('Batch ' + batchNo + ' run: ' + log.length + ' migrations \n').green +
                        log.join('\n').cyan);
                }
            })
            .catch(logError).finally(exit);
    }));

prog.command('migrate:rollback')
    .description('Rolls back the latest database migration')
    .action(init(function () {
        db_Main.migrate.rollback(knex_config)
            .spread(function(batchNo, log) {
                if (log.length === 0) {
                    console.log('Already at the base migration'.cyan);
                } else {
                    console.log(('Batch ' + batchNo + ' rolled back: ' + log.length + ' migrations \n').green +
                        log.join('\n').cyan);
                }
            })
            .catch(logError).finally(exit);
    }));

prog.command('migrate:current')
    .description('Display the latest database migration applied')
    .action(init(function () {
        db_Main.migrate.currentVersion(knex_config)
            .then(function(version) {
                console.log('Current Version: '.green + version.blue);
            })
            .catch(logError).finally(exit);
    }));

prog.command('migrate:make <name>')
    .description('Generate a new database migration')
    .action(init(function (name) {
        db_Main.migrate.make(name, knex_config)
            .then(function (filename) {
                console.log(('Migration ' + filename + ' created!').green);
            })
            .catch(logError).finally(exit);
    }));
