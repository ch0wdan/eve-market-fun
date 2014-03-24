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
        attrs.date = new Date(attrs.date);
        return attrs;
    }
});

exports.MarketHistories = BaseCollection.extend({
    model: exports.MarketHistory
});

exports.MarketMargin = BaseModel.extend({
    tableName: 'MarketMargins',
    relatedStatic: {
        typeID: ['invTypes', 'typeName'],
        stationID: ['staStations', 'stationName'],
        regionID: ['mapRegions', 'regionName']
    },
});

exports.MarketMargins = BaseCollection.extend({
    model: exports.MarketMargin
});

exports.MarketHistoryAggregate = BaseModel.extend({
    tableName: 'MarketHistoryAggregates',
    relatedStatic: {
        typeID: ['invTypes', 'typeName'],
        regionID: ['mapRegions', 'regionName']
    },
});

exports.MarketHistoryAggregates = BaseCollection.extend({
    model: exports.MarketHistoryAggregate
});

var type_cache = {};
var region_cache = {};
exports.processEmuu = function (market_data) {
    _.chain(market_data.rowsets).map(function (rowset) {
        if (!rowset.rows.length) { return; }

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
    
        Promise.all([
            type_cache[rowset.typeID] || eveData.invTypes({typeID: rowset.typeID}),
            region_cache[rowset.regionID] || eveData.mapRegions({regionID: rowset.regionID})
        ]).spread(function (items, regions) {
            type_cache[rowset.typeID] = items;
            region_cache[rowset.regionID] = regions;
            logger.info("%s market %s received for %s (%s) from %s (%s), %s queued",
                rowset.rows.length, market_data.resultType,
                items[0].typeName, rowset.typeID,
                regions[0].regionName, rowset.regionID, queue.length());
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
        marketMarginQueue.push(task);
    }).catch(function (e) {
        logger.error("Market order import error", e);
        logger.error(util.inspect(e));
    }).finally(next);
}, 1);

var marketMarginQueue = async.queue(function (task, next) {
    var by_station = {};
    _.each(task.rows, function (row) {
        if (!(row.stationID in by_station)) {
            by_station[row.stationID] = [];
        }
        by_station[row.stationID].push(row);
    });

    var models = [];
    _.each(by_station, function (rows, station_id) { 
        var model = new exports.MarketMargin({
            typeID: task.typeID,
            regionID: task.regionID,
            stationID: station_id,
            solarSystemID: rows[0].solarSystemID
        });
        var data = {
            maxBuyPrice: null,
            minSellPrice: null,
            baseMarginPercent: 0
        };
        _.each(rows, function (row) {
            if (row.bid) {
                if (data.maxBuyPrice == null || row.price > data.maxBuyPrice) {
                    data.maxBuyPrice = row.price;
                }
            } else {
                if (data.minSellPrice == null || row.price < data.minSellPrice) {
                    data.minSellPrice = row.price;
                }
            }
        });
        if (data.maxBuyPrice && data.minSellPrice) {
            data.baseMargin = data.minSellPrice - data.maxBuyPrice;
            if (data.baseMargin > 0) {
                data.baseMarginPercent = (data.baseMargin / data.minSellPrice) * 100;
            }
        }
        models.push(model.createOrUpdate(data));
    });

    logger.info("Market margins calculated for type " + task.typeID + " in " +
            models.length + " stations - " + 
            marketMarginQueue.length() + " queued");

    Promise.all(models)
        .catch(function (e) {
            logger.error("Market order import error", e);
            logger.error(util.inspect(e));
        })
        .finally(next);
}, 10);

// Calculate average % price volatility over the given range
function calcVolatility (rows, range) {
    range = range || rows.length;
    var prices = _.pluck(rows.slice(0, range+1), 'average');
    var mean = _.reduce(prices, function (memo, price) {
        return memo + price;
    }, 0) / range;
    var avg_deviation = _.chain(prices).map(function (price) {
        return Math.pow(price - mean, 2);
    }).reduce(function (memo, price) {
        return memo + price;
    }, 0).value() / range;
    return (Math.sqrt(avg_deviation) / mean) * 100;
};

var emuuHistoryQueue = async.queue(function (task, next) {
    if (task.rows.length == 1) {
        return next();
    }
    var db = exports.db_Main;
    var model = new exports.MarketHistoryAggregate({
        typeID: task.typeID,
        regionID: task.regionID
    });
    var data = {
        // history: JSON.stringify(task),
        avgDailyVolume: 0,
        avgDailyVolumeForMonth: 0,
        avgDailyVolumeForWeek: 0,
        volatility: calcVolatility(task.rows),
        volatilityForMonth: calcVolatility(task.rows, 7),
        volatilityForWeek: calcVolatility(task.rows, 30)
    };

    var volume_sum = 0;
    _.each(task.rows, function (row, idx) {
        volume_sum += row.quantity;
        if (idx == 7) {
            data.avgDailyVolumeForWeek = volume_sum / 7;
        } else if (idx == 30) {
            data.avgDailyVolumeForMonth = volume_sum / 30;
        }
    });
    data.avgDailyVolume = volume_sum / task.rows.length;

    model.createOrUpdate(data).then(function () {
        next();
    }).catch(function (e) {
        logger.error("Market history import error", e);
        next(e);
    });
}, 1);
