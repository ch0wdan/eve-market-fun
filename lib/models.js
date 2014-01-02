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
    if ('toJSON' in key) key = key.toJSON();
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
        // TODO: consider async methods?
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
        out.bidType = (['1', 'True'].indexOf(out.bid) !== -1) ? 'buy': 'sell';
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

var chunk_size = 50;
var processed = [];
var updateQueue = exports.MarketOrders.updateQueue =
    async.queue(function (row, next) {
        return exports.MarketOrder
        .forge({orderID: row.orderID})
        .createOrUpdate(row)
        .then(function (order) {
            processed.push(order);
            next();
        })
        .catch(function (e) { next(e) });
    }, chunk_size);

updateQueue.drain = function () {
    logger.verbose("%s market updates processed", processed.length);
    processed.length = 0;
};

exports.MarketOrders.logOrdersReceived = function (rowset) {
    eveData.invTypes({typeID: rowset.typeID})
    .then(function (items) {
        return Promise.all([
            items,
            eveData.mapRegions({ regionID: rowset.regionID })
        ]);
    }).spread(function (items, regions) {
        if (!items.length) { return; }
        var item = items[0];
        logger.info("%s received for %s (%s) from %s (%s)",
            rowset.rows.length, item.typeName, item.typeID,
            regions[0].regionName, rowset.regionID);
    });
};

exports.MarketOrders.processEmuuOrders = function (market_data) {
    _.chain(market_data.rowsets).map(function (rowset) {
        exports.MarketOrders.logOrdersReceived(rowset);
        var row_defaults = {
            typeID: rowset.typeID,
            orderState: 0
        };
        return _.map(rowset.rows, function (row) {
            return _.chain(market_data.columns).object(row)
                .defaults(row_defaults).value();
        });
    }).flatten().each(function (row) {
        exports.MarketOrders.updateQueue.push(row);
    });
};
