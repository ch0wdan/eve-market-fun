
exports.up = function(knex, Promise) {
    return knex.schema.table('ApiKeys', function (t) {
        t.string('accessMask');
        t.string('expires');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.table('ApiKeys', function (t) {
        t.dropColumn('accessMask');
        t.dropColumn('expires');
    });
};
