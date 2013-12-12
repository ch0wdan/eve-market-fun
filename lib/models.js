var util = require('util');
var _ = require('underscore');
var uuid = require('node-uuid');

var Bookshelf_Main = require('bookshelf').db_Main;

var BaseModel = Bookshelf_Main.Model.extend({

    hasTimestamps: true,
    
    idAttribute: 'uuid',
    
    defaults: function () {
        return {
            uuid: uuid.v1()
        };
    },

    createOrUpdate: function (props) {
        var orig = this;
        return this.fetch().then(function (model) {
            return (model || orig).save(props);
        })
    }

});

var BaseCollection = Bookshelf_Main.Collection.extend({
});

exports.User = BaseModel.extend({
    tableName: 'Users',
    defaults: function () {
        return _.extend(BaseModel.prototype.defaults(), {
        })
    },
    apiKeys: function () {
        return this.hasMany(exports.ApiKey, 'userUuid');
    },
    characters: function () {
        return this.hasMany(exports.Character, 'userUuid');
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
    }
});

exports.Characters = BaseCollection.extend({
    model: exports.Character
});

exports.MarketOrder = BaseModel.extend({
    tableName: 'MarketOrders'
});

exports.MarketOrders = BaseCollection.extend({
    model: exports.MarketOrder
});
