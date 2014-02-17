var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex) {
    var ks = knex.schema;
    return ks.table('WalletTransactions', function (t) {
        t.integer('characterID').unsigned().references('id').inTable('Characters');
    });
};

exports.down = function(knex) {
    var ks = knex.schema;
    return ks.table('WalletTransactions', function (t) {
        t.dropColumn('characterID');
    });
};
