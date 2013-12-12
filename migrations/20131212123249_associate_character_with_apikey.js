
exports.up = function(knex, Promise) {
    return knex.schema.table('Characters', function (t) {
        t.string('keyUuid').index();
    })
};

exports.down = function(knex, Promise) {
    return knex.schema.table('Characters', function (t) {
        t.dropColumn('keyUuid')
    })
};
