exports.up = function(knex, Promise) {
  return knex.schema.table('MarketTypes', function (t) {
    t.decimal('avgDailyVolume', 19, 4);
    t.decimal('avgDailyVolumeForWeek', 19, 4);
    t.decimal('avgDailyVolumeForMonth', 19, 4);
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('MarketTypes', function (t) {
    t.dropColumn('avgDailyVolume');
    t.dropColumn('avgDailyVolumeForWeek');
    t.dropColumn('avgDailyVolumeForMonth');
  });
};
