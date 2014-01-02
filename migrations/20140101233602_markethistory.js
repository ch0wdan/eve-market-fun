exports.up = function(knex, Promise) {
    return knex.schema.createTable('MarketHistory', function (t) {
        t.uuid('uuid').primary();
        t.timestamps();
        t.bigInteger('typeID').index();
        t.bigInteger('regionID').index();
        t.dateTime('date').index();
        t.integer('orders');
        t.integer('quantity');
        t.decimal('low', 19, 4);
        t.decimal('high', 19, 4);
        t.decimal('average', 19, 4);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('MarketHistory');
};
