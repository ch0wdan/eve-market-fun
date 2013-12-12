var util = require('util');
var _ = require('underscore');
var uuid = require('node-uuid');

var Bookshelf_Main = require('bookshelf').db_Main;

var BaseModel = Bookshelf_Main.Model.extend({
    
    hasTimestamps: true,

    defaults: function () {
        return {
            id: uuid.v1()
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
            status: 'good'
        })
    }
});

exports.Users = BaseCollection.extend({
    model: exports.User
});

exports.ApiKey = BaseModel.extend({
    tableName: 'ApiKeys'
});

exports.ApiKeys = BaseCollection.extend({
    model: exports.ApiKey
});

exports.Character = BaseModel.extend({
    tableName: 'Characters'
});

exports.Characters = BaseCollection.extend({
    model: exports.Character
});

exports.MarketShare = BaseModel.extend({
    tableName: 'MarketOrders'
});

exports.MarketShares = BaseCollection.extend({
    model: exports.MarketShare
});
