var Promise = require('bluebird');
exports.up = function(knex) {
    return knex.raw('ALTER TABLE MarketHistory MODIFY quantity BIGINT');
};
exports.down = function(knex) {
    return knex.raw('ALTER TABLE MarketHistory MODIFY quantity INT');
};
