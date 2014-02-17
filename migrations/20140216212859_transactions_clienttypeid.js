var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex) {
    var ks = knex.schema;
    return ks.table('WalletTransactions', function (t) {
        t.bigInteger('clientTypeID').unsigned().index();
    });
};

exports.down = function(knex) {
    var ks = knex.schema;
    return ks.table('WalletTransactions', function (t) {
        t.dropColumn('clientTypeID');
    });
};
