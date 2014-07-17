exports.up = function(knex, Promise) {
    return knex.schema.table('MarketTradeLeads', function (t) {
        t.text('trades');
        t.decimal('totalVolume', 19, 4);
        t.decimal('totalInvestment', 19, 4);
        t.decimal('totalProfit', 19, 4);
        t.decimal('iskPerM3', 19, 4);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.table('MarketTradeLeads', function (t) {
    });
};
