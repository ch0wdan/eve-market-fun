var _ = require('underscore');
var Promise = require('bluebird');

exports.up = function(knex) {
    var ks = knex.schema;
    return ks.createTable('WalletJournal', function (t) {
        t.engine('InnoDB');
        t.increments('id').primary();
        t.timestamps();
        t.dateTime('date');
        t.bigInteger('refID');
        t.bigInteger('refTypeID');
        t.string('ownerName1');
        t.bigInteger('ownerID1');
        t.string('ownerName2');
        t.bigInteger('ownerID2');
        t.string('argName1');
        t.bigInteger('argID1');
        t.decimal('amount', 19, 4);
        t.decimal('balance', 19, 4);
        t.string('reason');
        t.bigInteger('taxReceiverID');
        t.decimal('taxAmount', 19, 4)
        t.bigInteger('owner1TypeID');
        t.bigInteger('owner2TypeID');
    });
};

exports.down = function(knex) {
    var ks = knex.schema;
    return ks.dropTable('WalletJournal');
};
