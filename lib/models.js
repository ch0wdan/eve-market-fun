var util = require('util');

var _ = require('underscore');
var uuid = require('node-uuid');

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
    if ('toJSON' in key) key = key.toJSON({ reveal_vCode: true });
    return new Neow.Client(key, conf.get('neow_api_base'), neow_cache);
}

var BaseModel = Bookshelf_Main.Model.extend({

    hasTimestamps: true,
    
    idAttribute: 'uuid',
    
    defaults: function () {
        return {
            uuid: uuid.v1()
        };
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
        return this.hasMany(exports.ApiKeys, 'userUuid');
    },
    characters: function () {
        return this.hasMany(exports.Characters, 'userUuid');
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

exports.Sessions = BaseModel.extend({
    tableName: 'Sessions',
});

exports.Sessions = BaseCollection.extend({
    model: exports.Sessions
});

exports.ApiKey = BaseModel.extend({
    tableName: 'ApiKeys',
    user: function () {
        return this.belongsTo(exports.User, 'userUuid');
    },
    client: function () {
        return exports.neowClient(this);
    },
    characters: function () {
        return this.hasMany(exports.Characters, 'keyUuid');
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
        return this.belongsTo(exports.User, 'userUuid');
    },
    apiKey: function () {
        return this.belongsTo(exports.ApiKey, 'keyUuid');
    },
    marketOrders: function () {
        return this.hasMany(exports.MarketOrders, 'characterUuid');
    }
});

exports.Characters = BaseCollection.extend({
    model: exports.Character
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

        var normalized_cols = {
            "characterUUID": "characterUuid",
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
            'uuid', 'characterUuid', 'created_at', 'updated_at', 'orderID',
            'orderState', 'typeID', 'charID', 'regionID', 'stationID',
            'solarSystemID', 'accountKey', 'accountID', 'issueDate',
            'duration', 'price', 'escrow', 'range', 'volEntered',
            'volRemaining', 'minVolume', 'isCorp', 'bid'
        ];
        attrs = _.pick(attrs, accepted_cols);

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
    }
});

exports.MarketHistories = BaseCollection.extend({
    model: exports.MarketHistory
});

exports.processEmuu = function (market_data) {
    _.chain(market_data.rowsets).map(function (rowset) {
        // Emit a log message with useful type & region names for each rowset.
        Promise.all([
            eveData.invTypes({typeID: rowset.typeID}),
            eveData.mapRegions({regionID: rowset.regionID})
        ]).spread(function (items, regions) {
            logger.info("%s market %s received for %s (%s) from %s (%s)",
                rowset.rows.length, market_data.resultType,
                items[0].typeName, rowset.typeID,
                regions[0].regionName, rowset.regionID);
        
            // Extract the rows from the rowset, convert to objects.
            var row_defaults = {
                type: market_data.resultType,
                regionID: rowset.regionID,
                typeID: rowset.typeID
            };
            if ('orders' == market_data.resultType) {
                row_defaults.orderState = 0;
            }
            var rows = _.map(rowset.rows, function (row) {
                return _.chain(market_data.columns)
                    .object(row).defaults(row_defaults).value();
            });
            if ('orders' == market_data.resultType) {
                rows.push({
                    type: 'orders_cleanup',
                    regionID: rowset.regionID,
                    typeID: rowset.typeID,
                    orderIDs: _.pluck(rows, 'orderID'),
                    item: items[0].typeName,
                    region: regions[0].regionName
                });
            }
            rows.forEach(function (row) {
                emuuQueue.push(row);
            });
        });
    });
};

// TODO: Job expiration - if it takes more than TTL, delete from queue
// TODO: De-dupe - if a subsequent row arrives that would overwrite one from earlier, drop earlier
var rows_processed = 0;
var emuuQueue = async.queue(function (row, next) {
    if ('orders_cleanup' == row.type) {
        return exports.db_Main('MarketOrders')
            .whereNotIn('orderID', row.orderIDs)
            .andWhere('regionID', '=', row.regionID)
            .andWhere('typeID', '=', row.typeID)
            .del().then(function (ct) {
                if (ct > 0) {
                    logger.info(
                        "Cleaned up %s old market orders for %s in %s",
                        ct, row.item, row.region);
                }
                next();
            }).catch(function (e) {
                next(e)
            });
    }

    var model;
    if ('orders' == row.type) {
        model = new exports.MarketOrder({
            orderID: row.orderID
        })
    } else if ('history' == row.type) {
        model = new exports.MarketHistory({
            typeID: row.typeID,
            regionID: row.regionID,
            date: row.date
        });
    }
    delete row.type;
    model.createOrUpdate(row).then(function (order) {
        rows_processed++;
        if ((rows_processed % 100) == 0) {
            logger.verbose("%s rows in EMUU queue", emuuQueue.length());
        }
        next();
    }).catch(function (e) { next(e) });
}, 100);

emuuQueue.saturated = function () {
    logger.verbose("EMUU queue saturated");
};

emuuQueue.drain = function () {
    logger.verbose("EMUU queue drained, %s rows processed", rows_processed);
    rows_processed = 0;
};
