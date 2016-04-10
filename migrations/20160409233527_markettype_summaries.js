exports.up = function(knex, Promise) {
  return knex.schema
    .table('MarketTypes', function (t) {
      t.decimal('buy', 19, 4);
      t.decimal('sell', 19, 4);
      t.decimal('spread', 19, 4);
      t.decimal('margin', 19, 4);
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('MarketTypes', function (t) {
      t.dropColumn('buy');
      t.dropColumn('sell');
      t.dropColumn('spread');
      t.dropColumn('margin');
    });
};
