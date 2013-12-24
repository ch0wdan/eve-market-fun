exports.up = function(knex, Promise) {
    return knex.schema.createTable('Sessions', function (t) {
        t.uuid('uuid').primary();
        t.timestamps();
        t.text('data');
        t.dateTime('expires');
    });
};
exports.down = function(knex, Promise) {
    return knex.schema.dropTable('Sessions');
};
