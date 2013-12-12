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

exports.User = BaseModel.extend({
    tableName: 'Users',
    defaults: function () {
        return _.extend(BaseModel.prototype.defaults(), {
            status: 'good'
        })
    }
});

exports.ApiKey = BaseModel.extend({
    tableName: 'ApiKeys'
});

exports.Character = BaseModel.extend({
    tableName: 'Characters'
});

exports.MarketShare = BaseModel.extend({
    tableName: 'MarketOrders'
});
