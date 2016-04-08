exports.up = function (knex) {
  return knex.schema.createTable('Characters', function (t) {
    t.engine('InnoDB');
    t.increments('id').primary();
    t.timestamps();
    t.string('CharacterID').index().unique();
    t.string('CharacterName').index().unique();
    t.string('ExpiresOn');
    t.string('CharacterOwnerHash').index();
    t.string('accessToken');
    t.string('refreshToken');
    t.string('email').index();
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('Characters');
};
