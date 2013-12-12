
exports.up = function(knex, Promise) {
    return knex.schema.table('MarketOrders', function (t) {
        t.string('issued');
    })
};

exports.down = function(knex, Promise) {
    return knex.schema.table('MarketOrders', function (t) {
        t.dropColumn('issued');
    })
};


