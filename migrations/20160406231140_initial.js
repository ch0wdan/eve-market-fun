var Promise = require('bluebird');

exports.up = function (knex) {
  var ks = knex.schema;
  return Promise.all([
    ks.createTable('Characters', function (t) {
      t.engine('InnoDB');
      t.increments('id').primary();
      t.timestamps();
      t.string('CharacterID').index().unique();
      t.string('CharacterName').index().unique();
      t.string('ExpiresOn').index().unique();
      t.string('Scopes').index().unique();
      t.string('CharacterOwnerHash').index().unique();
      t.string('accessToken').index().unique();
      t.string('refreshToken').index().unique();
      t.string('email').index().unique();
    })
  ]);
};

exports.down = function (knex) {
  var ks = knex.schema;
  return Promise.all([
    knex.schema.dropTable('Characters')
  ]);
};
