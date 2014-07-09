var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex, Promise) {
    return knex.schema.table('MarketTradeLeads', function (t) {
        t.decimal('fromPrice', 19, 4);
        t.bigInteger('fromMarketMarginsID');
        t.decimal('toPrice', 19, 4);
        t.bigInteger('toMarketMarginsID');
    });
};

exports.down = function(knex, Promise) {
  
};
