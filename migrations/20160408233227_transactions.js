exports.up = function(knex) {
  return knex.schema.createTable('WalletTransactions', function (t) {
    t.increments('id').primary();
    t.timestamps();
    t.integer('characterID').unsigned().references('id').inTable('Characters');
    t.bigInteger('clientTypeID').unsigned().index();
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
  }).createTable('WalletJournal', function (t) {
    t.engine('InnoDB');
    t.increments('id').primary();
    t.timestamps();
    t.integer('characterID').unsigned().references('id').inTable('Characters');
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
    t.decimal('taxAmount', 19, 4);
    t.bigInteger('owner1TypeID');
    t.bigInteger('owner2TypeID');
  });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('WalletTransactions')
    .dropTable('WalletJournal');
};
