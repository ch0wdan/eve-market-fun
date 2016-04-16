exports.up = function(knex, Promise) {
  return knex.schema.table('MarketTypes', function (t) {
    t.json('buyPrices');
    t.json('sellPrices');
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('MarketTypes', function (t) {
    t.dropColumn('buyPrices');
    t.dropColumn('sellPrices');
  });
};
