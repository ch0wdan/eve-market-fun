var util = require('util');
var fs = require('fs');

var _ = require('underscore');
var conf = require(__dirname + '/config');
var logger = require('winston');
var prog = require('commander');

var async = require('async');
var Promise = require('bluebird');
var Knex = require('knex');
var Bookshelf = require('bookshelf');
var CSV = require('csv');
var Neow = require('neow');

var p_fs = Promise.promisifyAll(require('fs'));

prog.version('0.0.1')
    .option('-s, --silent', 'Silence informational output', false);

module.exports = function (argv) {
    // HACK: Force --help, if no arguments supplied at all.
    if (argv.length == 2) { argv.push('--help'); }
    prog.parse(argv);
}

var db_Main, db_EVE, knex_config, models, neow_cache, eveData;

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
                level: 'silly',
                colorize: true,
                timestamp: true
            });
        }

        // see: https://github.com/flatiron/logger/issues/89
        logger.setLevels({
            silly: 0, verbose: 1, debug: 2,
            info: 3, warn: 4, error: 5
        });

        Bookshelf.db_Main = Bookshelf.initialize(conf.get('database'));

        models = require('./models');
        models.db_EVE = db_EVE = Knex.initialize(conf.get('database_eve_static'));
        models.db_Main = db_Main = Knex.initialize(conf.get('database'));
        
        eveData = require('./eveData');
        eveData.db_EVE = db_EVE;

        knex_config = {
            directory: __dirname + '/../migrations',
            database: db_Main
        };

        var diskCache = require('neow/lib/caching/disk');
        neow_cache = new diskCache.DiskCache(conf.get('neow_cache_path'));

        return fn.apply($this, $arguments);
    }
}

var logError = function (err) {
    logger.error(err.stack);
};

var err = function (msg/*, ...*/) {
    logger.error.apply(logger, arguments);
    exit();
};

var exit = function () {
    db_Main.client.pool.destroy();
    process.exit();
};

var neowClient = function (key) {
    if ('toJSON' in key) { key = key.toJSON(); }
    return new Neow.Client(key, "https://api.eveonline.com", neow_cache);
}

prog.option('-R, --regions <10000048,10000032>',
            'Filter imports by region(s)',
            function (val) {
                if (!val) return;
                return _.map(val.split(','), function (val) {
                    return parseInt(val);
                });
            });

prog.command('serve')
    .description('Start web app')
    .action(init(require('./app')));

prog.command('user:manage <username> <password>')
    .description('Create or update a user account')
    .action(init(function (username, password) {
        models.User
            .forge({ username: username })
            .createOrUpdate({ password: password })
            .then(function (model) {
                logger.info("Updated user '%s'", username);
            })
            .catch(logError).finally(exit);
    }));

prog.command('user:delete <username>')
    .description('Delete a user account')
    .action(init(function (username, password) {
        models.User
            .forge({username: username})
            .fetch({require: true})
            .then(function (model) {
                logger.info("Deleting user '%s'", username);
                return model.destroy();
            })
            .catch(logError).finally(exit);
    }));

prog.command('user:detail <username>')
    .description('View details for a user')
    .action(init(function (username) {
        var user;
        models.User.forge({username: username})
            .fetch({require: true})
            .catch(function () {
                err("Could not find user '%s'", username);
            })
            // Fetch the user's API keys
            .then(function (user_in) {
                user = user_in;
                logger.info("User '%s'", user.get('username'));
                return user.apiKeys().fetch();
            })
            // Report on API keys, fetch all characters.
            .then(function (keys) {
                logger.info("API keys (%s):", keys.length);
                keys.each(function (key) {
                    logger.info("\t* %s", key.get('keyID'));
                });
                return user.characters().fetch({
                    withRelated: ['user', 'apiKey']
                });
            })
            .then(function (characters) {
                logger.info('Characters (%s):', characters.length);
                characters.each(function (character) {
                    logger.info("\t* %s (characterID: %s; keyID: %s)",
                        character.get('name'),
                        character.get('characterID'),
                        character.related('apiKey').get('keyID'));
                });
            })
            .catch(logError).finally(exit);
    }));

prog.command('key:manage <username> <keyid> <vcode>')
    .description('Add an API key for a user')
    .action(init(function (username, keyid, vcode) {
        var user;
        models.User.forge({username: username})
            .fetch({require: true})
            .catch(function () {
                err("Could not find user '%s'", username);
            })
            .then(function (user_in) {
                user = user_in;
                return neowClient({keyID: keyid, vCode: vcode})
                    .fetch('account:APIKeyInfo');
            })
            .catch(function () {
                err("Could not verify API key");
            })
            .then(function (result) {
                return models.ApiKey.forge({
                    userID: user.get('id'),
                    keyID: keyid,
                })
                .createOrUpdate({
                    vCode: vcode,
                    accessMask: result.key.accessMask,
                    expires: result.key.expires
                });
            })
            .then(function (key) {
                logger.info(
                    "Added key '%s' for user '%s' with accessMask '%s' " +
                    "and expires on '%s'",
                    key.get('keyID'), username,
                    key.get('accessMask'), key.get('expires')
                )
            })
            .catch(logError).finally(exit);
    }));

prog.command('key:delete <username> <keyid>')
    .description('Remove an API key for a user')
    .action(init(function (username, keyid) {
        models.User
            .forge({username: username})
            .fetch({require: true})
            .catch(function () {
                err("Could not find user '%s'", username);
            })
            .then(function (user) {
                return user.apiKeys()
                    .query({where: {keyID: keyid}})
                    .fetchOne({require: true});
            })
            .catch(function (e) {
                err("Unable to remove API key '%s' for user '%s'",
                    keyid, username, e);
            })
            .then(function (key) {
                logger.info("Removing API key '%s' for user '%s'",
                    keyid, username);
                return key.destroy();
            })
            .catch(logError).finally(exit);
    }));

prog.command('characters:fetch <username>')
    .description("Fetch characters for a user's API keys")
    .action(init(function (username) {
        var user;
        models.User.forge({username: username}).fetch({require: true})
            .catch(function () {
                err("Could not find user '%s'", username);
            })
            // Fetch the user's API keys
            .then(function (user_in) {
                user = user_in;
                return user.apiKeys().fetch().then(function (keys) {
                    if (keys.length === 0) {
                        err("User '%s' has no API keys", username);
                    }
                    return keys;
                });
            })
            // Fetch characters for each API key
            .then(function (keys) {
                return keys.mapThen(function (key) {
                    return neowClient(key).fetch('account:Characters')
                        .then(function (data) {
                            return [key.get('id'), data]
                        })
                });
            })
            // Flatten & de-dupe the character data
            .then(function (results) {
                var out = [];
                var seen = {};
                _.each(results, function (result) {
                    var key_ID = result[0];
                    _.each(result[1].characters, function (details, id) {
                        if (id in seen) { return }
                        seen[id] = 1;
                        out.push([key_ID, id, details]);
                    });
                });
                return out;
            })
            // Update each character in the database
            .map(function (character) {
                return models.Character.forge({
                    characterID: character[1],
                    userID: user.get('id'),
                    keyID: character[0]
                })
                .createOrUpdate(_.pick(character[2], [
                    'name', 'corporationName', 'corporationID'
                ]));
            })
            // Report on the update
            .then(function (models) {
                logger.info("Updated %s characters for user '%s'",
                    models.length, username);
                _.each(models, function (character) {
                    logger.info("  * %s (%s)",
                        character.get('name'),
                        character.get('characterID'))
                });
            })
            .catch(logError).finally(exit);
    }));

prog.command('marketorders:fetch <username> <character>')
    .description('Fetch market orders for a character')
    .action(init(function (username, character_id) {
        var character, key;

        models.User.forge({username: username})
            .fetch({require: true})
            .catch(function () {
                err("Could not find user '%s'", username);
            }).then(function (user) {
                return user.characters().query(function (qb) {
                    qb.where('name', '=', character_id)
                      .orWhere('characterID', '=', character_id)
                }).fetchOne({
                    withRelated: ['apiKey'],
                    require: true
                });
            }).catch(function (e) {
                err("Could not find character '%s'", character_id, e);
            }).then(function (character_in) {
                character = character_in;
                key = character.related('apiKey');

                logger.info("Fetching API market orders for '%s'",
                    character.get('name'));
                
                return key.client().fetch('char:MarketOrders', {
                    characterID: character.get('characterID')
                }).then(function (result) {
                    return _.values(result.orders)
                })
            }).catch(function (e) {
                err("Problem fetching market orders " + e, e);
            }).map(function (order) {
                order.characterID = character.get('id');
                order.issueDate = order.issued;
                delete order.issued;
                return models.MarketOrder
                    .forge({orderID: order.orderID})
                    .createOrUpdate(order);
            }).then(function (models) {
                logger.info("%s market orders found", models.length);
            }).catch(logError).finally(exit);
    }));

prog.command('marketorders:import [path]')
    .description('Import newest market orders exported from EVE client')
    .action(init(function (path) {
        path = path || conf.get('marketlogs_path');

        var chunk_size = 1000;

        var fresh_import_fns;
        if (fs.statSync(path).isFile()) {
            fresh_import_fns = [path];
        } else {
            // First, find all the newest versions of market exports with filenames
            // of the form "Sinq Laison-Omen Navy Issue-2013.12.13 060803.txt"
            var all_files = fs.readdirSync(path);
            fresh_import_fns = _.chain(all_files).filter(function (fn) {
                    // Find only filenames containing hyphens.
                    return fn.indexOf('-') !== -1;
                }).map(function (fn) {
                    // Split off the filename part with export datestamp.
                    var dp = fn.lastIndexOf('-');
                    return [fn.substr(0,dp), fn.substr(dp+1)];
                })
                // Sort in reverse-chronological order
                .sortBy(1).reverse()
                // Group by the region/item, pluck the newest from each group.
                .groupBy(0).values().pluck(0)
                // Reconstitute the split filenames.
                .map(function (p) {
                    return p.join('-'); 
                }).value();

            // Didn't find any files that look like EVE exports, just use all.
            if (fresh_import_fns.length === 0) {
                fresh_import_fns = _.filter(all_files, function (fn) {
                    return fn.indexOf('-') === -1; 
                });
            }

            fresh_import_fns = _.map(fresh_import_fns, function (fn) {
                return path + '/' + fn;
            });
        }

        // Cached character ID -> ID fetch utility.
        var character_cache = {};
        var fetchCharacterID = function (char_id) {
            if (char_id in character_cache) {
                return Promise.resolve(character_cache[char_id]);
            }
            return models.Character.forge({characterID: char_id}).fetch()
                .then(function (character) {
                    return character_cache[char_id] = (character) ?
                        character.get('id') : null;
                });
        };

        // Prepare the record storage queue
        var imported_ct = 0;
        var queue = async.queue(function (record, next) {
            var char_id = record.charID;
            fetchCharacterID(char_id)
                .then(function (character_ID) {
                    record.characterID = character_ID;
                    var order_id = record.orderID || record.orderid;
                    return models.MarketOrder.forge({ orderID: order_id })
                        .createOrUpdate(record)
                })
                .then(function (order) {
                    imported_ct++;
                    if ((imported_ct % chunk_size) == 0) {
                        logger.verbose("%s orders saved", imported_ct);
                    }
                    next();
                })
                .catch(function (e) {
                    // TODO: Need better handling here.
                    logger.error(e);
                    next(e);
                })
        }, chunk_size);

        // When the queue saturates, pause all streams.
        queue.saturated = function () {
            _.each(streams, function (stream, fn) {
                stream.pause();
            });
        };

        // When the queue drains, unpause streams. Exit if all streams done.
        queue.drain = function () {
            if (!_.keys(streams).length) { exit(); }
            _.each(streams, function (stream, fn) {
                stream.resume();
            });
        };

        // Fire up parsing streams for all the import files.
        var accpeted_ct = 0;
        var streams = _.chain(fresh_import_fns).map(function (fn) {
            var fields = [];
            logger.info("Importing %s", fn);
            var stream = CSV().from.path(fn)
                .on('error', function (e) {
                    delete streams[fn];
                    logger.info("Error parsing %s", fn, e);
                })
                .on('end', function (count) {
                    delete streams[fn];
                    logger.info("Total of %s orders parsed from %s", count, fn);
                })
                .on('record', function (row, index) {
                    if (0 === index) { return fields = row; }
                    var record = _.object(fields, row);
                    
                    var regionID = parseInt(record.regionID || record.regionid);
                    if (regionID && prog.regions && prog.regions.indexOf(regionID) == -1) return;

                    record.orderState = record.orderState || 0;
                    queue.push(record);

                    accpeted_ct++;
                    if ((accpeted_ct % chunk_size) == 0) {
                        logger.verbose("%s orders accepted", accpeted_ct);
                    }
                });
            return [fn, stream];
        }).object().value();
    }));

prog.command('marketorders:emdr')
    .description('Import market orders from the EMDR stream')
    .action(init(function () {
        var util = require('util');
        var zmq = require('zmq');
        var zlib = require('zlib');
        var sock = zmq.socket('sub');
        sock.connect('tcp://relay-us-central-1.eve-emdr.com:8050');
        sock.subscribe('');
        sock.on('message', function (msg) {
            zlib.inflate(msg, function (err, market_json) {
                var market_data = JSON.parse(market_json);
                var regionID = market_data.rowsets[0].regionID;
                if (prog.regions && prog.regions.indexOf(regionID) === -1) return;
                models.processEmuu(market_data);
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
                    console.log(('Batch ' + batchNo + ' run: ' + 
                            log.length + ' migrations \n').green +
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
                    console.log(('Batch ' + batchNo + ' rolled back: ' + 
                            log.length + ' migrations \n').green +
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
