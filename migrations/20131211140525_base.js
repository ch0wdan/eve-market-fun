var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function (knex) {
    var ks = knex.schema;
    return Promise.all([
        ks.createTable('Users', function (t) {
            t.uuid('uuid').primary();
            t.timestamps();
            t.string('username').index().unique();
            t.string('password');
        }),
        ks.createTable('ApiKeys', function (t) {
            t.uuid('uuid').primary();
            t.timestamps();
            t.uuid('userUuid').index();
            t.string('keyID').index().unique();
            t.string('vCode');
            t.string('accessMask');
            t.string('expires');
        }),
        ks.createTable('Characters', function (t) {
            t.uuid('uuid').primary();
            t.string('keyUuid').index();
            t.timestamps();
            t.uuid('userUuid').index();
            t.string('name');
            t.string('characterID').index();
            t.string('corporationName');
            t.string('corporationID');
        }),
        ks.createTable('MarketOrders', function (t) {
            t.uuid('uuid').primary();
            t.string('characterUuid').index();
            t.timestamps();
            t.bigInteger('orderID').unique();
            t.integer('orderState').index();
            t.bigInteger('typeID').index();
            t.bigInteger('charID');
            t.bigInteger('regionID').index();
            t.bigInteger('stationID').index();
            t.bigInteger('solarSystemID');
            t.string('accountKey');
            t.string('accountID');
            t.string('issueDate');
            t.string('duration');
            t.decimal('price', 19, 4);
            t.decimal('escrow', 19, 4);
            t.integer('range');
            t.bigInteger('volEntered');
            t.bigInteger('volRemaining');
            t.bigInteger('minVolume');
            t.boolean('isCorp');
            t.boolean('bid').index();
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
