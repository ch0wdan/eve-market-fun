exports.up = function(knex, Promise) {
  return knex.schema.table('Characters', function (t) {
    t.renameColumn('CharacterID', 'characterID');
    t.renameColumn('CharacterName', 'characterName');
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('Characters', function (t) {
    t.renameColumn('characterID', 'CharacterID');
    t.renameColumn('characterName', 'CharacterName');
  });
};
