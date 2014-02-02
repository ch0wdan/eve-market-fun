exports.up = function(knex, Promise) {
    return knex.schema.createTable('LocationFavorites', function (t) {
        t.uuid('uuid').primary();
        t.timestamps();
        t.uuid('userUuid').index();
        t.bigInteger('regionID');
        t.bigInteger('constellationID');
        t.bigInteger('solarSystemID');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('LocationFavorites');
};
