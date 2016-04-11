exports.up = function(knex, Promise) {
  return knex.schema.table('MarketTypes', function (t) {
    t.string('marketGroupID');
    t.json('marketGroupIDPath');
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('MarketTypes', function (t) {
    t.dropColumn('marketGroupID');
    t.dropColumn('marketGroupIDPath');
  });
};
