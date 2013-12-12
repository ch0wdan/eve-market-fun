
exports.up = function(knex, Promise) {
    return knex.schema.table('Characters', function (t) {
        t.string('keyID').index();
    })
};

exports.down = function(knex, Promise) {
    return knex.schema.table('Characters', function (t) {
        t.dropColumn('keyID')
    })
};
