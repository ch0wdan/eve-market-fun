exports.up = function(knex, Promise) {
  return knex.schema
    .createTable('MarketTypes', function (t) {
      t.engine('InnoDB');
      t.increments('id').primary();
      t.timestamps();
      t.bigInteger('regionID').index();
      t.bigInteger('typeID').index();
      t.json('history');
      t.json('buyOrders');
      t.json('sellOrders');
    })
    .dropTable('MarketOrders')
    .dropTable('MarketHistory');
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTable('MarketTypes')
    .createTable('MarketOrders', function (t) {
      t.engine('InnoDB');
      t.increments('id').primary();
      t.timestamps();
      t.bigInteger('typeID').index();
      t.bigInteger('regionID').index();
      t.json('orders');
    })
    .createTable('MarketHistory', function (t) {
      t.engine('InnoDB');
      t.increments('id').primary();
      t.timestamps();
      t.bigInteger('typeID').index();
      t.bigInteger('regionID').index();
      t.json('history');
    });
};
