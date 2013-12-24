exports.up = function(knex, Promise) {
    return knex.schema.table('Users', function (t) {
        t.string('email').index().unique();
    })
};
exports.down = function(knex, Promise) {
    return knex.schema.table('Users', function (t) {
        t.dropColumn('email');
    })
};
