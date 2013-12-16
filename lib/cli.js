var util = require('util');
var fs = require('fs');

var _ = require('underscore');
var conf = require(__dirname + '/config');
var logger = require('winston');
var prog = require('commander');

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
                level: 'silly', colorize: true
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
                    userUuid: user.get('uuid'),
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
                            return [key.get('uuid'), data]
                        })
                });
            })
            // Flatten & de-dupe the character data
            .then(function (results) {
                var out = [];
                var seen = {};
                _.each(results, function (result) {
                    var key_uuid = result[0];
                    _.each(result[1].characters, function (details, id) {
                        if (id in seen) { return }
                        seen[id] = 1;
                        out.push([key_uuid, id, details]);
                    });
                });
                return out;
            })
            // Update each character in the database
            .map(function (character) {
                return models.Character.forge({
                    characterID: character[1],
                    userUuid: user.get('uuid'),
                    keyUuid: character[0]
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
                
                return neowClient(key).fetch('char:MarketOrders', {
                    characterID: character.get('characterID')
                }).then(function (result) {
                    return _.values(result.orders)
                })
            }).catch(function (e) {
                err("Problem fetching market orders", e);
            }).map(function (order) {
                order.characterUuid = character.get('uuid');
                order.issueDate = order.issued;
                delete order.issued;
                return models.MarketOrder
                    .forge({orderID: order.orderID})
                    .createOrUpdate(order);
            }).then(function (models) {
                logger.info("%s market orders found", models.length);
            }).catch(logError).finally(exit);
    }));

function importCSV (fn) {
    return new Promise(function (resolve, reject) {
        var fields = [];
        var data = [];
        CSV().from.path(fn)
            .on('record', function (row, index) {
                if (0 == index) { fields = row; }
                else { data.push(_.object(fields, row)); }
            })
            .on('end', function (count) { resolve(data) })
            .on('error', function (error) { reject(error) })
    });
}

prog.command('marketorders:import [path]')
    .description('Import newest market orders exported from EVE client')
    .action(init(function (path) {
        path = path || conf.get('marketlogs_path');

        var all_files = fs.readdirSync(path);
    
        // First, find all the newest versions of market exports with filenames
        // of the form "Sinq Laison-Omen Navy Issue-2013.12.13 060803.txt"
        var fresh_import_fns = _.chain(all_files).filter(function (fn) {
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
        
        var chars = {};

        Promise.all(_.map(fresh_import_fns, function (fn) {
            // Parse all market export CSVs
            var full_fn = path + '/' + fn;
            return importCSV(full_fn).then(function (orders) {
                logger.info("Parsed %s orders from %s, importing...",
                    orders.length, fn);
                return orders;
            });
        })).reduce(function (a, b) {
            // Merge all the separate exports into one pile of orders.
            return a.concat(b);
        }, []).then(function (orders) {
            // Look up any characters that appear in the list of orders.
            var char_ids = _.chain(orders)
                .pluck('charID').compact().uniq()
                .value();
            return Promise.all(_.map(char_ids, function (id) {
                return models.Character.forge({characterID: id})
                    .fetch().then(function (character) {
                        if (character) {
                            chars[id] = character.get('uuid');
                        }
                    });
            })).then(function () { return orders; });
        }).map(function (order) {
            // Save all the orders to the database.
            var record = _.pick(order, [
                'orderID', 'typeID', 'charID', 'regionID', 'stationID',
                'range', 'bid', 'price', 'volEntered', 'volRemaining',
                'issueDate', 'orderState', 'minVolume', 'accountID',
                'duration', 'isCorp', 'solarSystemID', 'escrow'
            ]);
            if (chars[record.charID]) {
                record.characterUUID = chars[record.charID];
            }
            return models.MarketOrder
                .forge({orderID: record.orderID})
                .createOrUpdate(record);
        }).settle().then(function (results) {
            logger.info("Imported %s total orders", results.length);
        }).catch(logError).finally(exit);
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

                if ('orders' != market_data.resultType) return;
                if ('10000032' != market_data.rowsets[0].regionID) return;

                Promise.all(_.map(market_data.rowsets, function (rowset) {
                    return eveData.invTypes({typeID: rowset.typeID})
                        .then(function (items) {
                            if (!items.length) { return; }
                            var item = items[0];
                            return Promise.all([
                                item,
                                Promise.all(_.map(rowset.rows, function (row) {
                                    var order = _.object(market_data.columns, row);
                                    order.typeID = rowset.typeID;
                                    order.orderState = 0;
                                    return models.MarketOrder
                                        .forge({orderID: order.orderID})
                                        .createOrUpdate(order);
                                }))
                            ]);
                        })
                        .spread(function (item, orders) {
                            logger.info("%s received for %s (%s)",
                                orders.length, item.typeName, item.typeID);
                        });
                }));
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
