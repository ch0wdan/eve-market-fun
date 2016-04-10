exports.up = function(knex) {
  return knex.schema.table('Characters', function (t) {
    t.json('orders');
  }).createTable('MarketOrders', function (t) {
    t.engine('InnoDB');
    t.increments('id').primary();
    t.timestamps();
    t.bigInteger('typeID').index();
    t.bigInteger('regionID').index();
    t.json('orders');
  }).createTable('MarketHistory', function (t) {
    t.engine('InnoDB');
    t.increments('id').primary();
    t.timestamps();
    t.bigInteger('typeID').index();
    t.bigInteger('regionID').index();
    t.json('history');
  });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('MarketOrders')
    .dropTable('MarketHistory');
};
