var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex) {
    var ks = knex.schema;
    return ks.createTable('MarketTradeLeads', function (t) {
        t.engine('InnoDB');
        
        t.increments('id').primary();
        t.timestamps();
        
        t.bigInteger('typeID').index();
        
        t.bigInteger('fromRegionID').index();
        t.bigInteger('fromSolarSystemID').index();
        t.bigInteger('fromStationID').index();
        t.boolean('fromBid').index();
        t.bigInteger('fromTopOrderID');

        t.bigInteger('toRegionID').index();
        t.bigInteger('toSolarSystemID').index();
        t.bigInteger('toStationID').index();
        t.boolean('toBid').index();
        t.bigInteger('toTopOrderID');

        t.decimal('baseMargin', 19, 4);
        t.decimal('baseMarginPercent', 19, 4);
        t.decimal('baseMarginPerM3', 19, 4);
    });
};

exports.down = function(knex) {
    var ks = knex.schema;
    return ks.dropTable('MarketTradeLeads');
};
