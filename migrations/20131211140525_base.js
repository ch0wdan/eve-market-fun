var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function (knex) {
    var ks = knex.schema;
    return Promise.all([
        ks.createTable('Users', function (t) {
            t.increments('id').primary();
            t.timestamps();
            t.string('username').index().unique();
            t.string('password');
        }),
        ks.createTable('ApiKeys', function (t) {
            t.increments('id').primary();
            t.timestamps();
            t.string('keyID').index().unique();
            t.string('vcode');
        }),
        ks.createTable('Characters', function (t) {
            t.increments('id').primary();
            t.timestamps();
            t.integer('userID').index();
            t.string('name');
            t.string('characterID').index();
            t.string('corporationName');
            t.string('corporationID');
        }),
        ks.createTable('MarketOrders', function (t) {
            t.increments('id').primary();
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
        knex.schema.dropTable('MarketOrders')
    ]);
};
