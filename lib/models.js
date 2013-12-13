var util = require('util');

var _ = require('underscore');
var uuid = require('node-uuid');

var conf = require(__dirname + '/config');

var Promise = require('bluebird');
var Knex = require('knex');
var Bookshelf_Main = require('bookshelf').db_Main;

exports.db_Main = null;
exports.db_EVE = null;

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
    }

});

var BaseCollection = Bookshelf_Main.Collection.extend({

    joinFromStatic: function () {
        var collection = this;
        var related = collection.model.prototype.relatedStatic;
        var joiner = function (detail, model_key_col) {
            var static_table = detail[0];
            var static_key_col = model_key_col;
            var static_value_col = detail[1];
            var model_value_col = detail[1];

            var keys = _(collection.pluck(model_key_col)).uniq();

            return exports.db_EVE(static_table)
                .select(static_key_col, static_value_col)
                .whereIn(static_key_col, keys)
                .then(function (rows) {
                    var static_map = _.chain(rows).map(function (r) {
                        return [r[static_key_col], r[static_value_col]];
                    }).object().value();
                    collection.each(function (model) {
                        var key = model.get(model_key_col);
                        var value = static_map[key];
                        model.set(model_value_col, value);
                    })
                })
        };
        var joiners = _(related).map(joiner);
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

exports.ApiKey = BaseModel.extend({
    tableName: 'ApiKeys',
    user: function () {
        return this.belongsTo(exports.User, 'userUuid');
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
        stationID: ['staStations', 'stationName']
    }
});

exports.MarketOrders = BaseCollection.extend({
    model: exports.MarketOrder
});
