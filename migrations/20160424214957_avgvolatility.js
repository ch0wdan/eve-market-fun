exports.up = function(knex, Promise) {
  return knex.schema.table('MarketTypes', function (t) {
    t.decimal('volatility', 19, 4);
    t.decimal('volatilityForWeek', 19, 4);
    t.decimal('volatilityForMonth', 19, 4);
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('MarketTypes', function (t) {
    t.dropColumn('volatility');
    t.dropColumn('volatilityForWeek');
    t.dropColumn('volatilityForMonth');
  });
};
