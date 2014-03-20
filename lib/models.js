var util = require('util');

var _ = require('underscore');

var conf = require(__dirname + '/config');
var logger = require('winston');

var bcrypt = require('bcrypt-nodejs');
var async = require('async');
var Promise = require('bluebird');
var Knex = require('knex');
var Bookshelf_Main = require('bookshelf').db_Main;
var Neow = require('neow');

exports.db_Main = null;
exports.db_EVE = null;

var eveData = require('./eveData');

var diskCache = require('neow/lib/caching/disk');
neow_cache = new diskCache.DiskCache(conf.get('neow_cache_path'));

exports.neowClient = function (key) {
    key = key || {};
    if ('pick' in key) {
        key = key.pick(['keyID', 'vCode']);
    }
    return new Neow.Client(key, conf.get('neow_api_base'), neow_cache);
}

var BaseModel = Bookshelf_Main.Model.extend({

    hasTimestamps: true,
    
    defaults: function () {
        return {};
    },

    relatedStatic: {},

    createOrUpdate: function (props) {
        var orig = this;
        return this.fetch().then(function (model) {
            return (model || orig).save(props);
        });
    },

    toJSON: function (options) {
        var out = Bookshelf_Main.Model.prototype.toJSON.call(this, options);
        return (!this.static) ? out : _.extend(out, this.static);
    }

});

var BaseCollection = Bookshelf_Main.Collection.extend({

    joinFromStatic: function () {
        var collection = this;
        var related = collection.model.prototype.relatedStatic;
        var joiners = _(related).map(function (detail, model_key_col) {
            var static_table = detail[0];
            var static_key_col = model_key_col;
            var static_value_col = detail[1];
            var model_value_col = detail[1];

            var keys = _(collection.pluck(model_key_col)).uniq();
            if (keys.length) {
                return exports.db_EVE(static_table)
                    .select(static_key_col, static_value_col)
                    .whereIn(static_key_col, keys)
                    .then(function (rows) {
                        var static_map = _.chain(rows).map(function (r) {
                            return [r[static_key_col], r[static_value_col]];
                        }).object().value();
                        collection.each(function (model) {
                            if (!model.static) model.static = {};
                            var key = model.get(model_key_col);
                            var value = static_map[key];
                            model.static[model_value_col] = value;
                        })
                    });
            }
        });
        return Promise.all(joiners).then(function () {
            return collection
        });
    }

});

exports.User = BaseModel.extend({
    tableName: 'Users',
    defaults: function () {
        return _.extend(BaseModel.prototype.defaults(), {
        })
    },
    validPassword: function (password) {
        return bcrypt.compareSync(password, this.get('password'));
    },
    hashPassword: function (password) {
        var user = this;
        var salt = bcrypt.genSaltSync(10);
        var hash = bcrypt.hashSync(password, salt);
        user.set('password', hash);
        return user;
    },
    apiKeys: function () {
        return this.hasMany(exports.ApiKeys, 'userID');
    },
    characters: function () {
        return this.hasMany(exports.Characters, 'userID');
    },
    locationFavorites: function () {
        return this.hasMany(exports.LocationFavorites, 'userID');
    },
    toJSON: function (options) {
        var out = BaseModel.prototype.toJSON.call(this, options);
        delete out.password;
        return out;
    }
});

exports.Users = BaseCollection.extend({
    model: exports.User
});

exports.LocationFavorite = BaseModel.extend({
    tableName: 'LocationFavorites',
    relatedStatic: {
        regionID: ['mapRegions', 'regionName'],
        constellationID: ['mapConstellations', 'constellationName'],
        solarSystemID: ['mapSolarSystems', 'solarSystemName']
    },
    user: function () {
        return this.belongsTo(exports.User, 'userID');
    }
});

exports.LocationFavorites = BaseCollection.extend({
    model: exports.LocationFavorite
});

exports.Sessions = BaseModel.extend({
    tableName: 'Sessions',
});

exports.Sessions = BaseCollection.extend({
    model: exports.Sessions
});

exports.ApiKey = BaseModel.extend({
    tableName: 'ApiKeys',
    user: function () {
        return this.belongsTo(exports.User, 'userID');
    },
    client: function () {
        return exports.neowClient(this);
    },
    characters: function () {
        return this.hasMany(exports.Characters, 'keyID');
    },
    destroy: function () {
        var key = this;
        return key.characters().fetch().then(function (characters) {
            return Promise.all(characters.map(function (c) {
                return c.destroy();
            }));
        }).then(function () {
            return BaseModel.prototype.destroy.call(key);
        });
    },
    toJSON: function (options) {
        options = _.defaults(options || {}, {
            reveal_vCode: false
        });
        var out = BaseModel.prototype.toJSON.call(this, options);
        if (!options.reveal_vCode) delete out.vCode;
        return out;
    }
});

exports.ApiKeys = BaseCollection.extend({
    model: exports.ApiKey
});

exports.Character = BaseModel.extend({
    tableName: 'Characters',
    user: function () {
        return this.belongsTo(exports.User, 'userID');
    },
    apiKey: function () {
        return this.belongsTo(exports.ApiKey, 'keyID');
    },
    marketOrders: function () {
        return this.hasMany(exports.MarketOrders, 'characterID');
    },
    transactions: function () {
        return this.hasMany(exports.WalletTransaction, 'characterID');
    }
});

exports.Characters = BaseCollection.extend({
    model: exports.Character
});

exports.WalletTransaction = BaseModel.extend({
    tableName: 'WalletTransactions'
});

exports.WalletTransactions = BaseCollection.extend({
    model: exports.WalletTransaction
});

exports.WalletJournal = BaseModel.extend({
    tableName: 'WalletJournal'
});

exports.WalletJournals = BaseCollection.extend({
    model: exports.WalletJournal
});

exports.MarketOrder = BaseModel.extend({
    tableName: 'MarketOrders',
    relatedStatic: {
        typeID: ['invTypes', 'typeName'],
        stationID: ['staStations', 'stationName'],
        regionID: ['mapRegions', 'regionName']
    },
    toJSON: function (options) {
        var out = BaseModel.prototype.toJSON.call(this, options);
        _.each(['price', 'volEntered', 'volRemaining'], function (name) {
            out[name] = parseFloat(out[name]);
        });
        out.bidType = (out.bid) ? 'buy': 'sell';
        return out;
    },
    cleanAttrs: function (attrs) {
        var normalized_cols = {
            "characterid": "characterID",
            "orderid": "orderID",
            "regionid": "regionID",
            "systemid": "systemID",
            "stationid": "stationID",
            "typeid": "typeID",
            "minvolume": "minVolume",
            "volremain": "volRemaining",
            "volenter": "volEntered",
            "issued": "issueDate"
        };
        _.each(normalized_cols, function (to_name, from_name) {
            if (!(from_name in attrs)) { return; }
            attrs[to_name] = attrs[from_name];
            delete attrs[from_name];
        });

        var date_cols = ['issueDate'];
        _.each(date_cols, function (name) {
            if (!(name in attrs)) { return; }
            var d = new Date();
            d.setTime(Date.parse(attrs[name]));
            attrs[name] = d;
        });

        var boolean_cols = ['bid', 'isCorp'];
        _.each(boolean_cols, function (name) {
            if (!(name in attrs)) { return; }
            attrs[name] = 
                (attrs[name] === 'True') || 
                (attrs[name] === '1') || 
                (attrs[name] === true) || 
                (attrs[name] === 1)
        });

        var accepted_cols = [
            'id', 'characterID', 'created_at', 'updated_at', 'orderID',
            'orderState', 'typeID', 'charID', 'regionID', 'stationID',
            'solarSystemID', 'accountKey', 'accountID', 'issueDate',
            'duration', 'price', 'escrow', 'range', 'volEntered',
            'volRemaining', 'minVolume', 'isCorp', 'bid'
        ];
        return _.pick(attrs, accepted_cols);
    },
    set: function (key, val, options) {
        if (key == null) return this;
        var attrs;
        if (typeof key === 'object') {
            attrs = key;
            options = val;
        } else {
            (attrs = {})[key] = val;
        }
        options || (options = {});
        attrs = this.cleanAttrs(attrs);
        return BaseModel.prototype.set.call(this, attrs, options);
    }
});

exports.MarketOrders = BaseCollection.extend({
    model: exports.MarketOrder
});

exports.MarketHistory = BaseModel.extend({
    tableName: 'MarketHistory',
    relatedStatic: {
        typeID: ['invTypes', 'typeName'],
        regionID: ['mapRegions', 'regionName']
    },
    cleanAttrs: function (attrs) {
        return attrs;
    }
});

exports.MarketHistories = BaseCollection.extend({
    model: exports.MarketHistory
});

exports.processEmuu = function (market_data) {
    _.chain(market_data.rowsets).map(function (rowset) {
        Promise.all([
            eveData.invTypes({typeID: rowset.typeID}),
            eveData.mapRegions({regionID: rowset.regionID})
        ]).spread(function (items, regions) {
            logger.info("%s market %s received for %s (%s) from %s (%s)",
                rowset.rows.length, market_data.resultType,
                items[0].typeName, rowset.typeID,
                regions[0].regionName, rowset.regionID);
            var row_defaults = {
                regionID: rowset.regionID,
                typeID: rowset.typeID,
                updated_at: new Date(),
                created_at: new Date()
            };
            var clean_attrs, queue;
            if ('orders' == market_data.resultType) {
                row_defaults.orderState = 0;
                clean_attrs = exports.MarketOrder.prototype.cleanAttrs;
                queue = emuuQueue;
            } else if ('history' == market_data.resultType) {
                clean_attrs = exports.MarketHistory.prototype.cleanAttrs;
                queue = emuuHistoryQueue;
            } else {
                return;
            }
            rowset.rows = _.map(rowset.rows, function (row) {
                return clean_attrs(
                    _.chain(market_data.columns)
                    .object(row).defaults(row_defaults)
                    .value());
            });
            queue.push(rowset);
        });
    });
};

var emuuQueue = async.queue(function (task, next) {
    // In a transaction, delete all the rows for the item in the region. Then,
    // insert all the orders. This assumes that each rowset represents a
    // replacement export - might be a dumb idea.
    var db = exports.db_Main;
    db.transaction(function (t) {
        db('MarketOrders').transacting(t).where({
            typeID: task.typeID,
            regionID: task.regionID 
        }).del().then(function () {
            return db('MarketOrders').transacting(t).insert(task.rows);
        }).then(t.commit, t.rollback);
    }).then(function () {
        next();
    }).catch(function (e) {
        next(e);
    });
}, 10);

var emuuHistoryQueue = async.queue(function (task, next) {
    // In a transaction, delete the history for item by date & region. Then
    // insert the history rows in a batch, assuming they're replacements.
    // Again, might be a dumb idea.
    var dates = _.pluck(task.rows, 'date');
    var db = exports.db_Main;
    db.transaction(function (t) {
        db('MarketHistory').transacting(t).whereIn('date', dates).andWhere({
            typeID: task.typeID,
            regionID: task.regionID 
        }).del().then(function () {
            return db('MarketHistory').transacting(t).insert(task.rows);
        }).then(t.commit, t.rollback);
    }).then(function () {
        next();
    }).catch(function (e) {
        next(e);
    });
}, 10);
