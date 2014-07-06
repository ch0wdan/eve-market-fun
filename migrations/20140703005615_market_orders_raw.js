var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex) {
    var ks = knex.schema;
    return ks.createTable('MarketDataRaw', function (t) {
        t.engine('InnoDB');
        t.increments('id').primary();
        t.timestamps();
        t.bigInteger('typeID').index();
        t.bigInteger('regionID').index();
        t.dateTime('generatedAt').index();
        t.string('resultType').index();
        t.text('rowset');
    })
};

exports.down = function(knex) {
    var ks = knex.schema;
    return ks.dropTable('MarketDataRaw');
};
