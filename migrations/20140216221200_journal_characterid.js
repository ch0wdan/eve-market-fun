var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex) {
    var ks = knex.schema;
    return ks.table('WalletJournal', function (t) {
        t.integer('characterID').unsigned().references('id').inTable('Characters');
    });
};

exports.down = function(knex) {
    var ks = knex.schema;
    return ks.table('WalletJournal', function (t) {
        t.dropColumn('characterID');
    });
};
