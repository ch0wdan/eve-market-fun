var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex) {
    var ks = knex.schema;
    return ks.createTable('WalletTransactions', function (t) {
        t.dateTime('transactionDateTime').index();
        t.bigInteger('transactionID').unsigned().index();
        t.integer('quantity');
        t.string('typeName');
        t.bigInteger('typeID').unsigned().index();
        t.decimal('price', 19, 4);
        t.bigInteger('clientID').unsigned().index();
        t.string('clientName');
        t.bigInteger('stationID').unsigned().index();
        t.string('stationName');
        t.string('transactionType');
        t.string('transactionFor');
        t.bigInteger('journalTransactionID').unsigned().index();
    });
};

exports.down = function(knex) {
    var ks = knex.schema;
    return ks.dropTable('WalletTransactions');
};
