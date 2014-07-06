var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex, Promise) {
    return knex.schema.dropTableIfExists('MarketHistory');
};

exports.down = function(knex, Promise) {
    return ks.createTable('MarketHistory', function (t) {
        t.engine('InnoDB');
        t.increments('id').primary();
        t.timestamps();
        t.bigInteger('typeID').index();
        t.bigInteger('regionID').index();
        t.dateTime('date').index();
        t.integer('orders');
        t.bigInteger('quantity');
        t.decimal('low', 19, 4);
        t.decimal('high', 19, 4);
        t.decimal('average', 19, 4);
    });
};
