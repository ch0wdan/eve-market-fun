exports.up = function (knex, Promise) {
  return knex.schema.createTable('ApiKeys', function (t) {
    t.engine('InnoDB');
    t.increments('id').primary();
    t.timestamps();
    t.string('keyID').index().unique();
    t.string('vCode');
    t.string('accessMask');
    t.string('expires');
    t.string('type');
  }).createTable('ApiKeys_Characters', function (t) {
    t.engine('InnoDB');
    t.integer('ApiKeys_id').references('ApiKeys.id');
    t.integer('Characters_id').references('Characters.id');
  }).table('Characters', function (t) {
    t.string('corporationID');
    t.string('corporationName');
    t.string('allianceID');
    t.string('allianceName');
    t.string('factionID');
    t.string('factionName');
  });
};

exports.down = function (knex, Promise) {
  return knex.schema
    .dropTable('ApiKeys')
    .dropTable('ApiKeys_Characters')
    .table('Characters', function (t) {
      t.dropColumn('corporationID');
      t.dropColumn('corporationName');
      t.dropColumn('allianceID');
      t.dropColumn('allianceName');
      t.dropColumn('factionID');
      t.dropColumn('factionName');
    });
};
