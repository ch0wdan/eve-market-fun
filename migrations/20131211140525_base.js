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
            t.string('characterUuid');
            t.timestamps();
            t.integer('orderID').unique();
            t.integer('orderState');
            t.integer('typeID');
            t.integer('charID');
            t.integer('regionID');
            t.integer('stationID');
            t.integer('solarSystemID');
            t.string('accountKey');
            t.string('accountID');
            t.string('issueDate');
            t.integer('duration');
            t.decimal('price');
            t.decimal('escrow');
            t.integer('range');
            t.integer('volEntered');
            t.integer('volRemaining');
            t.integer('minVolume');
            t.boolean('isCorp');
            t.boolean('bid');
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
