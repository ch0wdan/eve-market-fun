var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function (knex) {
    var ks = knex.schema;
    return Promise.all([
        ks.createTable('Users', function (t) {
            t.uuid('id').primary();
            t.timestamps();
            t.string('username').index().unique();
            t.string('password');
            t.string('status');
        }),
        ks.createTable('ApiKeys', function (t) {
            t.uuid('id').primary();
            t.timestamps();
            t.string('userID').index();
            t.string('keyID').index().unique();
            t.string('vCode');
        }),
        ks.createTable('Characters', function (t) {
            t.uuid('id').primary();
            t.timestamps();
            t.integer('userID').index();
            t.string('name');
            t.string('characterID').index();
            t.string('corporationName');
            t.string('corporationID');
        }),
        ks.createTable('MarketOrders', function (t) {
            t.uuid('id').primary();
            t.timestamps();
            t.integer('userID').index();
            _.each(
                // Copypasta from the CSV header of an EVE market log export
                'orderID,typeID,charID,charName,regionID,regionName,stationID,stationName,range,bid,price,volEntered,volRemaining,issueDate,orderState,minVolume,accountID,duration,isCorp,solarSystemID,solarSystemName,escrow'.split(','),
                function (name) {
                    var c = t.string(name);
                    if ('orderID' == name) { c.index().unique(); }
                }
            );
        })
    ]);
};

exports.down = function (knex) {
    var ks = knex.schema;
    return Promise.all([
        knex.schema.dropTable('Users'),
        knex.schema.dropTable('ApiKeys'),
        knex.schema.dropTable('Characters'),
        knex.schema.dropTable('MarketOrders')
    ]);
};
