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
var CSV = require('csv');
var moment = require('moment');

var eveData = require(__dirname + '/eveData');
var utils = require(__dirname + '/utils');
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

function roundTo100 (amount) {
    return Math.round(amount * 100) / 100;
}

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

        var float_cols = ['price', 'volRemaining', 'volEntered'];
        _.each(float_cols, function (name) {
            if (!(name in attrs)) { return; }
            attrs[name] = parseFloat(attrs[name], 10);
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
    model: exports.MarketOrder,

    updateFromCSV: function (csv_stream) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var columns = [];
            var updates = [];

            CSV().from.stream(csv_stream)
            .on('record', function (row, index) {
                if (0 === index) { return columns = row; }
                var record = _.object(columns, row);
                updates.push(self.model.forge({
                    orderID: record.orderID
                }).createOrUpdate(record));
            })
            .on('error', function (e) { reject(e); })
            .on('end', function (count) {
                resolve(Promise.all(updates));
            });
        });
    },

    queryWithRaw: function (opts) {

        ['regionID', 'constellationID', 'solarSystemID', 'stationID']
            .forEach(function (name) {
                if (opts.hasOwnProperty(name)) {
                    opts[name] = utils.coerceArray(opts[name]);
                }
            });

        var statics = {};

        return eveData.lookupRegions(opts).then(function (regionID) {
            
            return Promise.props({
                
                types: exports.db_EVE('invTypes')
                    .select('typeID as key', 'typeName as value')
                    .where('typeID', '=', opts.typeID),

                regions: exports.db_EVE('mapRegions')
                    .select('regionID as key', 'regionName as value')
                    .whereIn('regionID', regionID),
                
                stations: exports.db_EVE('staStations')
                    .select('stationID as key', 'stationName as value')
                    .whereIn('regionID', regionID),

                raws: exports.MarketDataRaws.forge().query(function (qb) {
                    qb.andWhere('typeID', '=', opts.typeID)
                      .andWhere('resultType', '=', 'orders')
                      .whereIn('regionID', regionID);
                }).fetch(),

                orders: exports.MarketOrders.forge().query(function (qb) {
                    qb.andWhere('typeID', '=', opts.typeID)
                      .andWhere('orderState', '=', 0)
                      .whereIn('regionID', regionID);
                    if ('bid' in opts) {
                        qb.andWhere('bid', '=', opts.bid);
                    }
                    if (opts.stationID) {
                        qb.whereIn('stationID', opts.stationID);
                    } else if (opts.solarSystemID) {
                        qb.whereIn('solarSystemID', opts.solarSystemID);
                    } else if (opts.constellationID) {
                        qb.whereIn('solarSystemID', function () {
                            this.select('solarSystemID').from('mapSolarSystems')
                                .whereIn('constellationID', opts.constellationID);
                        });
                    }
                }).fetch()

            });
        }).then(function (props) {
            var raws = props.raws;
            var orders = props.orders;

            ['types', 'regions', 'stations'].forEach(function (name) {
                statics[name] = _.chain(props[name]).map(function (row) {
                    return [row.key, row.value];
                }).object().value();
            });
            
            var out = orders.invoke('toJSON');
            var seen_orderids = {};
            _.each(out, function (order) {
                seen_orderids[order.orderID] = true;
            });

            raws.each(function (raw) {
                var raw_rows = _.filter(raw.rows(), function (row) {
                    if (seen_orderids[row.orderID]) {
                        return false;
                    }
                    if ('bid' in opts && row.bid != opts.bid) {
                        return false;
                    }
                    // FIXME: This whole string/number inconsistency is annoying.
                    if ('stationID' in opts &&
                            opts.stationID.indexOf(''+row.stationID) === -1) {
                        return false;
                    }
                    if ('solarSystemID' in opts &&
                            opts.solarSystemID.indexOf(''+row.solarSystemID) === -1) {
                        return false;
                    }
                    return true;
                });
                out = out.concat(raw_rows);
            });

            return out.map(function (order) {
                order.typeName = statics.types[order.typeID];
                order.regionName = statics.regions[order.regionID];
                order.stationName = statics.stations[order.stationID];
                return order;
            });
        });
    }
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

        var float_cols = ['price', 'volRemaining', 'volEntered'];
        _.each(float_cols, function (name) {
            if (!(name in attrs)) { return; }
            attrs[name] = parseFloat(attrs[name], 10);
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
    },

    updateFromCSV: function (csv_stream) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var columns = [];
            var idx_typeID, idx_regionID;
            var by_update = {};

            CSV().from.stream(csv_stream)
            .on('record', function (row, index) {
                if (0 === index) { 
                    columns = row;
                    idx_typeID = columns.indexOf('typeID');
                    idx_regionID = columns.indexOf('regionID');
                    return;
                }
                // TODO: Handle if/when columns aren't the first row, ie. the format is borked.
                var key = row[idx_typeID] + ':' + row[idx_regionID];
                if (!by_update[key]) { by_update[key] = []; }
                by_update[key].push(row);
            })
            .on('error', function (e) { reject(e); })
            .on('end', function (count) {
                var updates = _.map(by_update, function (rows, key) {
                    var parts = key.split(':');
                    return self.model.forge({
                        resultType: 'orders',
                        typeID: parts[0],
                        regionID: parts[1]
                    }).createOrUpdate({
                        generatedAt: new Date(),
                        rowset: JSON.stringify({
                            columns: columns,
                            rows: rows
                        })
                    });
                });
                resolve(Promise.all(updates));
            });
        });
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
        fromSolarSystemID: ['mapSolarSystems', 'solarSystemName', 'solarSystemID', 'fromSolarSystemName'],
        toSolarSystemID: ['mapSolarSystems', 'solarSystemName', 'solarSystemID', 'toSolarSystemName'],
        fromRegionID: ['mapRegions', 'regionName', 'regionID', 'fromRegionName'],
        toRegionID: ['mapRegions', 'regionName', 'regionID', 'toRegionName'],
        fromStationID: ['staStations', 'stationName', 'stationID', 'fromStationName'],
        toStationID: ['staStations', 'stationName', 'stationID', 'toStationName']
    },

    cleanAttrs: function (attrs) {
        var boolean_cols = ['fromBid', 'toBid'];
        boolean_cols.forEach(function (name) {
            if (!(name in attrs)) { return; }
            attrs[name] = 
                (attrs[name] === 'True') || 
                (attrs[name] === '1') || 
                (attrs[name] === true) || 
                (attrs[name] === 1)
        });
        var round_names = [
            'baseMargin', 'fromPrice', 'toPrice', 'iskPerM3',
            'totalInvestment', 'totalProfit', 'baseMarginPercent'
        ];
        round_names.forEach(function (name) {
            if (!(name in attrs)) { return; }
            attrs[name] = roundTo100(attrs[name]);
        });
        return attrs;
    }

});

exports.MarketTradeLeads = BaseCollection.extend({

    model: exports.MarketTradeLead,

    updateFromMarketData: function (type_id, a_region_id, hubs) {
        var self = this;
        hubs = hubs || TRADE_HUBS;

        var a_hub = hubs[a_region_id];
        if (!a_hub) {
            return Promise.all([]);
        }

        var MarketMargins = exports.MarketMargins.forge();
        var MarketDataRaws = exports.MarketDataRaws.forge();

        return MarketMargins.query(function (qb) {
            qb.where({typeID: type_id, stationID: a_hub.stationID});
        }).fetch().then(function (a_margins) {
            var a_margin = a_margins.first();
            if (!a_margin) { return; }

            // TODO: Replace with an async queue?
            return Promise.all(_.map(hubs, function (b_hub) {
                var b_region_id = b_hub.regionID;
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
                        
                        var from_station_id = from_margin.get('stationID');
                        var to_station_id = to_margin.get('stationID');

                        var from_price = from_margin.get(
                            cmp.from_bid ? 'maxBuyPrice' : 'minSellPrice');
                        var to_price = to_margin.get(
                            cmp.to_bid ? 'maxBuyPrice' : 'minSellPrice');

                        if (from_price < to_price) {
                            var margin = to_price - from_price;
                            var margin_perc = (margin / to_price) * 100;

                            return Promise.all([

                                exports.MarketDataRaws.forge().query(function (qb) {
                                    qb.where({
                                        resultType: 'orders',
                                        typeID: type_id,
                                        regionID: from_margin.get('regionID')
                                    });
                                }).fetch(),

                                exports.MarketDataRaws.forge().query(function (qb) {
                                    qb.where({
                                        resultType: 'orders',
                                        typeID: type_id,
                                        regionID: to_margin.get('regionID')
                                    });
                                }).fetch(),
                                
                                exports.db_EVE('invTypes')
                                    .select('volume').where('typeID', '=', type_id)

                            ]).spread(function (from_data, to_data, item_data) {

                                if (!(from_data || to_data)) { return; }

                                var from_orders = _.chain(from_data.first().rows())
                                    .filter(function (o) {
                                        return o.bid == cmp.from_bid &&
                                               o.stationID == from_station_id;
                                    }).sortBy('price').value();
                                if (cmp.from_bid) { from_orders.reverse(); }

                                var to_orders = _.chain(to_data.first().rows())
                                    .filter(function (o) { 
                                        return o.bid == cmp.to_bid &&
                                               o.stationID == to_station_id;
                                    }).sortBy('price').value();
                                if (cmp.to_bid) { to_orders.reverse(); }

                                if (!(from_orders.length || to_orders.length)) { return; }
                                
                                var trades = [];

                                var curr_from = from_orders.shift();
                                var curr_to = to_orders.shift();
                                if (!curr_from || !curr_to || curr_from.price > curr_to.price) { return; }

                                if (cmp.from_bid && !cmp.to_bid) {
                                    // Volume from own buy order to own sell
                                    // order is notionally infinite.
                                    trades.push({
                                        from_price: curr_from.price,
                                        to_price: curr_to.price,
                                        volume: 1
                                    });

                                } else {

                                    while (curr_from && curr_to) {

                                        if (curr_from.price > curr_to.price) { break; }

                                        var vol;
                                        if (cmp.from_bid) {
                                            // Volume from own sell order is notionally infinite
                                            vol = curr_to.volRemaining;
                                        } else if (!cmp.to_bid) {
                                            // Volume to own buy order is notionally infinite
                                            vol = curr_from.volRemaining;
                                        } else {
                                            // Volume from sell order to buy order need to be matched.
                                            vol = (curr_from.volRemaining > curr_to.volRemaining) ?
                                                curr_to.volRemaining : curr_from.volRemaining;
                                        }

                                        trades.push({
                                            from_price: curr_from.price,
                                            to_price: curr_to.price,
                                            volume: vol
                                        });

                                        if (!cmp.from_bid) {
                                            // When from a sell order, decrement the remaining volume
                                            // and pick up the next order when necessary
                                            curr_from.volRemaining -= vol;
                                            if (curr_from.volRemaining <= 0) {
                                                curr_from = from_orders.shift();
                                            }
                                        }

                                        if (cmp.to_bid) {
                                            // When to a buy order, decrement the volume and pick up
                                            // next order when necessary
                                            curr_to.volRemaining -= vol;
                                            if (curr_to.volRemaining <=0 ) {
                                                curr_to = to_orders.shift();
                                            }
                                        }

                                    }

                                }

                                var totals = _.reduce(trades, function (memo, trade) {
                                    memo.volume += trade.volume;
                                    memo.investment += trade.from_price * trade.volume;
                                    memo.sales += trade.to_price * trade.volume;
                                    return memo;
                                }, { volume: 0, investment: 0, sales: 0 });
                                totals.profit = totals.sales - totals.investment;
                                var isk_per_m3 = totals.profit / (item_data[0].volume * totals.volume);
                            
                                return self.model.forge({
                                    typeID: type_id,
                                    fromStationID: from_station_id,
                                    fromBid: cmp.from_bid,
                                    toStationID: to_station_id,
                                    toBid: cmp.to_bid
                                }).createOrUpdate({
                                    fromRegionID: from_margin.get('regionID'),
                                    fromSolarSystemID: from_margin.get('solarSystemID'),
                                    toRegionID: to_margin.get('regionID'),
                                    toSolarSystemID: to_margin.get('solarSystemID'),
                                    baseMargin: margin,
                                    baseMarginPercent: margin_perc,
                                    fromMarketMarginsID: from_margin.id,
                                    fromPrice: from_price,
                                    toMarketMarginsID: to_margin.id,
                                    toPrice: to_price,
                                    trades: JSON.stringify(trades),
                                    totalVolume: totals.volume,
                                    totalInvestment: totals.investment,
                                    totalProfit: totals.profit,
                                    iskPerM3: isk_per_m3
                                });
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
