var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function (knex) {
    var ks = knex.schema;
    return Promise.all([
        ks.table('MarketHistoryAggregates', function (t) {
            t.text('history', 'longtext');
        }),
        ks.dropTable('MarketHistory')
    ]);
};

exports.down = function (knex) {
    var ks = knex.schema;
    return Promise.all([
        ks.table('MarketHistoryAggregates', function (t) {
            t.decimal('profitByVolume', 19, 4);
            t.decimal('profitByVolumeForMonth', 19, 4);
            t.decimal('profitByVolumeForWeek', 19, 4);
        }),
        ks.createTable('MarketHistory', function (t) {
            t.engine('InnoDB');
            t.increments('id').primary();
            t.timestamps();
            t.bigInteger('typeID').index();
            t.bigInteger('regionID').index();
            t.dateTime('date').index();
            t.integer('orders');
            t.integer('quantity');
            t.decimal('low', 19, 4);
            t.decimal('high', 19, 4);
            t.decimal('average', 19, 4);
        })
    ]);
};
