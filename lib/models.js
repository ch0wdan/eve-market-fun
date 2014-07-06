var util = require('util');

var _ = require('underscore');

var conf = require(__dirname + '/config');
var logger = require('winston');

var bcrypt = require('bcrypt-nodejs');
var async = require('async');
var Promise = require('bluebird');
var Knex = require('knex');
var Bookshelf_Main = conf.Bookshelf_Main;
var Neow = require('neow');

var eveData = require(__dirname + '/eveData');
var models = exports;

exports.db_Main = conf.db_Main;
exports.db_EVE = conf.db_EVE;

var diskCache = require('neow/lib/caching/disk');
neow_cache = new diskCache.DiskCache(conf.get('neow_cache_path'));

var TRADE_HUBS = exports.TRADE_HUBS = _.chain([
    ['Jita',    30000142, 10000002, 60003760],
    ['Rens',    30002510, 10000030, 60004588],
    ['Hek',     30002053, 10000042, 60005686],
    ['Amarr',   30002187, 10000043, 60008494],
    ['Dodixie', 30002659, 10000032, 60011866]
]).map(function (row) {
    var obj = _.object([
        'solarSystemName', 'solarSystemID', 'regionID', 'stationID'
    ], row);
    return [obj.regionID, obj];
}).object().value();

var LEAD_COMPARISONS = [];
[true, false].forEach(function (from_bid) {
    [true, false].forEach(function (to_bid) {
        ['a', 'b'].forEach(function (from_name) {
            LEAD_COMPARISONS.push({
                from_name: from_name,
                from_bid: from_bid,
                to_name: ('a' === from_name) ? 'b' : 'a',
                to_bid: to_bid
            });
        });
    });
});

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
        return Bookshelf_Main.Model.prototype.set.call(this, attrs, options);
    },

    cleanAttrs: function (attrs) {
        return attrs;
    }

});

var BaseCollection = Bookshelf_Main.Collection.extend({

    joinFromStatic: function () {
        var collection = this;
        var related = collection.model.prototype.relatedStatic;
        var joiners = _(related).map(function (detail, model_key_col) {
            var static_table = detail[0];
            var static_key_col = detail[2] ? detail[2] : model_key_col;
            var static_value_col = detail[1];
            var model_value_col = detail[3] ? detail[3] : detail[1];

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
    tableName: 'WalletJournal',
    cleanAttrs: function (attrs) {
        attrs.taxAmount = parseFloat(attrs.taxAmount) || 0.0;
        if (!attrs.taxReceiverID) {
            attrs.taxReceiverID = null;
        }
        return attrs;
    }
});

exports.WalletJournals = BaseCollection.extend({
    model: exports.WalletJournal
});

exports.MarketDataRaw = BaseModel.extend({
    
    tableName: 'MarketDataRaw',

    relatedStatic: {
        typeID: ['invTypes', 'typeName'],
        regionID: ['mapRegions', 'regionName']
    },
    
    rows: function () {
        var rowset = JSON.parse(this.get('rowset'));
        var clean_fn = this['cleanAttrs_' + this.get('resultType')];
        return _.map(rowset.rows, function (row) {
            return clean_fn(_.chain(rowset.columns).object(row).value());
        });
    },
    
    cleanAttrs_history: function (attrs) {
        attrs.date = new Date(attrs.date);
        return attrs;
    },
    
    cleanAttrs_orders: function (attrs) {
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
    }
});

exports.MarketDataRaws = BaseCollection.extend({
    model: exports.MarketDataRaw,
    updateFromEMDR: function (market_data) {
        // TODO: Merge new history rows with existing?
        return Promise.all(_.map(market_data.rowsets, function (rowset) {
            return this.model.forge({
                resultType: market_data.resultType,
                typeID: rowset.typeID,
                regionID: rowset.regionID
            }).createOrUpdate({
                generatedAt: rowset.generatedAt,
                rowset: JSON.stringify({
                    columns: market_data.columns,
                    rows: rowset.rows
                })
            });
        }, this));
    }
});

exports.MarketMargin = BaseModel.extend({
    tableName: 'MarketMargins',
    relatedStatic: {
        typeID: ['invTypes', 'typeName'],
        stationID: ['staStations', 'stationName'],
        regionID: ['mapRegions', 'regionName'],
        solarSystemID: ['mapSolarSystems', 'solarSystemName']
    },
});

exports.MarketMargins = BaseCollection.extend({
    
    model: exports.MarketMargin,

    updateFromMarketData: function (type_id, region_id) {
        var self = this;

        return exports.MarketDataRaws.forge().query(function (qb) {
            qb.where({
                resultType: 'orders',
                typeID: type_id,
                regionID: region_id
            }).orderBy('updated_at', 'desc');
        }).fetch().then(function (objs) {

            if (0 === objs.length) { return Promise.all([]); }
            var market_data = objs.first();

            var rows = market_data.rows();
            if (0 === rows.length) { return Promise.all([]); }

            var margins = [];
            var by_station = _.groupBy(rows, 'stationID');

            _.each(by_station, function (orders, station_id) {
                var by_bid = _.groupBy(orders, 'bid');

                if (!(true in by_bid && false in by_bid)) { return; }

                var sell_orders = _.sortBy(by_bid[false], 'price');
                var buy_orders = _.sortBy(by_bid[true], 'price').reverse();

                var solar_system_id = sell_orders[0].solarSystemID;
                var min_sell = sell_orders[0].price;
                var max_buy = buy_orders[0].price;
                var margin = min_sell - max_buy;
                var margin_perc = (margin / min_sell) * 100;

                margins.push(self.model.forge({
                    typeID: type_id,
                    regionID: region_id,
                    stationID: station_id,
                    solarSystemID: solar_system_id
                }).createOrUpdate({
                    maxBuyPrice: max_buy,
                    minSellPrice: min_sell,
                    baseMargin: margin,
                    baseMarginPercent: margin_perc
                }));
            });

            return Promise.all(margins);
        });
    }

});

exports.MarketTradeLead = BaseModel.extend({
    tableName: 'MarketTradeLeads',
    relatedStatic: {
        typeID: ['invTypes', 'typeName'],
        fromSolarSystemID: ['mapSolarSystems', 'solarSystemName',
            'solarSystemID', 'fromSolarSystemName'],
        toSolarSystemID: ['mapSolarSystems', 'solarSystemName',
            'solarSystemID', 'toSolarSystemName'],
        fromRegionID: ['mapRegions', 'regionName',
            'regionID', 'fromRegionName'],
        toRegionID: ['mapRegions', 'regionName',
            'regionID', 'toRegionName']
    }
});

exports.MarketTradeLeads = BaseCollection.extend({
    model: exports.MarketTradeLead,

    updateFromMarketData: function (type_id, a_region_id, hubs) {
        var self = this;
        hubs = hubs || TRADE_HUBS;

        var a_hub = hubs[a_region_id];
        if (!a_hub) { return Promise.all([]); }

        var MarketMargins = exports.MarketMargins.forge();

        return MarketMargins.query(function (qb) {
            qb.where({typeID: type_id, stationID: a_hub.stationID});
        }).fetch().then(function (a_margins) {
            var a_margin = a_margins.first();
            if (!a_margin) { return; }

            // TODO: Replace with an async queue?
            return Promise.all(_.map(hubs, function (b_hub, b_region_id) {
                if (a_hub.stationID === b_hub.stationID) { return; }
            
                return MarketMargins.query(function (qb) {
                    qb.where({typeID: type_id, stationID: b_hub.stationID});
                }).fetch().then(function (b_margins) {
                    var b_margin = b_margins.first();
                    if (!b_margin) { return; }

                    // TODO: Replace with an async queue?
                    return Promise.all(_.map(LEAD_COMPARISONS, function (cmp) {

                        var from_margin = ('a' === cmp.from_name) ?
                            a_margin : b_margin;
                        var to_margin = ('a' === cmp.to_name) ?
                            a_margin : b_margin;
                        var from_price = from_margin.get(
                            cmp.from_bid ? 'maxBuyPrice' : 'minSellPrice');
                        var to_price = to_margin.get(
                            cmp.to_bid ? 'maxBuyPrice' : 'minSellPrice');
                        
                        if (to_price < from_price) {
                            var margin = from_price - to_price;
                            var margin_perc = (margin / from_price) * 100;

                            return self.model.forge({
                                typeID: type_id,
                                fromRegionID: from_margin.get('regionID'),
                                fromSolarSystemID: from_margin.get('solarSystemID'),
                                fromStationID: from_margin.get('stationID'),
                                fromBid: cmp.from_bid ? 1 : 0,
                                toRegionID: to_margin.get('regionID'),
                                toSolarSystemID: to_margin.get('solarSystemID'),
                                toStationID: to_margin.get('stationID'),
                                toBid: cmp.to_bid ? 1 : 0
                            }).createOrUpdate({
                                baseMargin: margin,
                                baseMarginPercent: margin_perc
                                // TODO: Need to add original from/to price here
                                // TODO: Maybe add from/to margin IDs
                            });
                        }

                    }));
                });
            }));
        }).then(function (result) {
            // Finally, return the flattened list of all leads discovered.
            return _.chain(result).flatten().compact().value();
        });
    }
});

exports.MarketHistoryAggregate = BaseModel.extend({
    tableName: 'MarketHistoryAggregates',
    relatedStatic: {
        typeID: ['invTypes', 'typeName'],
        regionID: ['mapRegions', 'regionName']
    },
});

exports.MarketHistoryAggregates = BaseCollection.extend({
    model: exports.MarketHistoryAggregate,
    updateFromMarketData: function (type_id, region_id) {
        var self = this;

        return exports.MarketDataRaws.forge().query(function (qb) {
            qb.where({
                resultType: 'history',
                typeID: type_id,
                regionID: region_id
            }).orderBy('updated_at', 'desc');
        }).fetch().then(function (objs) {

            if (0 === objs.length) { return; }
            var market_data = objs.first();

            var rows = market_data.rows();
            if (0 === rows.length) { return; }

            var model = new exports.MarketHistoryAggregate({
                typeID: type_id,
                regionID: region_id
            });

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

            var data = {
                avgDailyVolume: 0,
                avgDailyVolumeForMonth: 0,
                avgDailyVolumeForWeek: 0,
                volatility: calcVolatility(rows),
                volatilityForMonth: calcVolatility(rows, 7),
                volatilityForWeek: calcVolatility(rows, 30)
            };

            var volume_sum = 0;
            _.each(rows, function (row, idx) {
                volume_sum += row.quantity;
                if (idx == 7) {
                    data.avgDailyVolumeForWeek = volume_sum / 7;
                } else if (idx == 30) {
                    data.avgDailyVolumeForMonth = volume_sum / 30;
                }
            });
            data.avgDailyVolume = volume_sum / rows.length;

            return model.createOrUpdate(data);
        });
    }
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
    }
});

exports.MarketOrders = BaseCollection.extend({
    model: exports.MarketOrder
});
