var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex) {
    return Promise.all([
        knex.schema.table('MarketOrders', function (t) {
            t.dropColumn('characterID');
        }),
        knex.schema.table('MarketOrders', function (t) {
            t.integer('characterID').unsigned().references('id').inTable('Characters');
        })
    ]);
};

exports.down = function(knex) {
    return Promise.all([
        knex.schema.table('MarketOrders', function (t) {
            t.dropColumn('characterID');
        }),
        knex.schema.table('MarketOrders', function (t) {
            t.string('characterID').index();
        })
    ]);
};
