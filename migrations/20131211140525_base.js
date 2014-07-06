var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function (knex) {
    var ks = knex.schema;
    return Promise.all([
        ks.createTable('Users', function (t) {
            t.engine('InnoDB');
            t.increments('id').primary();
            t.timestamps();
            t.string('username').index().unique();
            t.string('password');
            t.string('email').index().unique();
        }),
        ks.createTable('ApiKeys', function (t) {
            t.engine('InnoDB');
            t.increments('id').primary();
            t.timestamps();
            t.integer('userID').unsigned().references('id').inTable('Users');
            t.string('keyID').index().unique();
            t.string('vCode');
            t.string('accessMask');
            t.string('expires');
        }),
        ks.createTable('Characters', function (t) {
            t.engine('InnoDB');
            t.increments('id').primary();
            t.timestamps();
            t.integer('keyID').unsigned().references('id').inTable('ApiKeys');
            t.integer('userID').unsigned().references('id').inTable('Users');
            t.string('name');
            t.string('characterID').index();
            t.string('corporationName');
            t.string('corporationID');
        }),
        ks.createTable('MarketOrders', function (t) {
            t.engine('InnoDB');
            t.increments('id').primary();
            t.integer('characterID').unsigned().references('id').inTable('Characters');
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
        }),
        ks.createTable('MarketHistory', function (t) {
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
        }),
        ks.createTable('LocationFavorites', function (t) {
            t.engine('InnoDB');
            t.increments('id').primary();
            t.timestamps();
            t.integer('userID').unsigned().references('id').inTable('Users');
            t.bigInteger('regionID');
            t.bigInteger('constellationID');
            t.bigInteger('solarSystemID');
        })
    ]);
};

exports.down = function (knex) {
    var ks = knex.schema;
    return Promise.all([
        knex.schema.dropTable('Users'),
        knex.schema.dropTable('ApiKeys'),
        knex.schema.dropTable('Characters'),
        knex.schema.dropTable('MarketOrders'),
        knex.schema.dropTable('MarketHistory'),
        knex.schema.dropTable('LocationFavorites')
    ]);
};
