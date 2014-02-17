var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex) {
    var ks = knex.schema;
    return ks.table('WalletTransactions', function (t) {
        t.increments('id').primary();
        t.timestamps();
    });
};

exports.down = function(knex) {
    var ks = knex.schema;
    return ks.table('WalletTransactions', function (t) {
        t.dropColumns('id', 'updated_at', 'created_at');
    });
};
