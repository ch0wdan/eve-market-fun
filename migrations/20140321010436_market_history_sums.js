var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function (knex) {
    var ks = knex.schema;
    return Promise.all([
        ks.createTable('MarketHistoryAggregates', function (t) {
            t.engine('InnoDB');
            t.increments('id').primary();
            t.timestamps();
            t.bigInteger('typeID').index();
            t.bigInteger('regionID').index();
            t.decimal('avgDailyVolume', 19, 4);
            t.decimal('avgDailyVolumeForMonth', 19, 4);
            t.decimal('avgDailyVolumeForWeek', 19, 4);
            t.decimal('volatility', 19, 4);
            t.decimal('volatilityForMonth', 19, 4);
            t.decimal('volatilityForWeek', 19, 4);
        })
    ]);
};

exports.down = function (knex) {
    var ks = knex.schema;
    return Promise.all([
        knex.schema.dropTable('MarketHistoryAggregates'),
        ks.table('MarketMargins', function (t) {
            t.decimal('avgDailyVolume', 19, 4);
            t.decimal('avgDailyVolumeForMonth', 19, 4);
            t.decimal('avgDailyVolumeForWeek', 19, 4);
            t.decimal('volatility', 19, 4);
            t.decimal('volatilityForMonth', 19, 4);
            t.decimal('volatilityForWeek', 19, 4);
            t.decimal('profitByVolume', 19, 4);
            t.decimal('profitByVolumeForMonth', 19, 4);
            t.decimal('profitByVolumeForWeek', 19, 4);
        })
    ]);
};
