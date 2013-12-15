var util = require('util');

var _ = require('underscore');
var uuid = require('node-uuid');

var conf = require(__dirname + '/config');

var Promise = require('bluebird');
var Knex = require('knex');

exports.db_EVE = null;

exports.invTypes = function (opts) {
    var query = exports.db_EVE('invTypes')
        .join('invGroups', 'invTypes.groupID', '=', 'invGroups.groupID')
        .join('invCategories', 'invGroups.categoryID', '=', 'invCategories.categoryID')
        //.join('invMetaTypes', 'invTypes.typeID', '=', 'invMetaTypes.typeID')
        //.join('invMetaGroups', 'invMetaTypes.metaGroupID', '=', 'invMetaGroups.metaGroupID')
        .select('invGroups.groupName',
                'invCategories.categoryName',
                //'invMetaGroups.metaGroupName'
                'invTypes.*');
    if (opts.typeID) {
        if (!_.isArray(opts.typeID)) {
            opts.typeID = [ opts.typeID ];
        }
        return query.whereIn('typeID', opts.typeID);
    }
    if (opts.marketGroupID) {
        return exports.invMarketGroupIDs(opts.marketGroupID)
            .then(function (ids) {
                return query.whereIn('marketGroupID', ids)
            }).catch(function (e) {
                util.debug(e);
            });
    }
};

exports.invMarketGroupIDs = function (marketGroupID) {
    if (!_.isArray(marketGroupID)) {
        marketGroupID = [marketGroupID];
    }
    return exports.db_EVE('invMarketGroups')
        .select('marketGroupID', 'parentGroupID')
        .whereIn('parentGroupID', marketGroupID)
        .then(function (rows) {
            var ids = _.map(rows, function (row) {
                return exports.invMarketGroupIDs(row.marketGroupID);
            });
            ids.unshift(marketGroupID);
            return Promise.all(ids);
        })
        .reduce(function (a, b) {
            return a.concat(b);
        }, [])
        .then(function (results) {
            return _.uniq(results);
        });
};

exports.invMarketGroups = function (root_ids, shallow) {
    if (root_ids && !_.isArray(root_ids)) {
        root_ids = [root_ids];
    }
    // Utility to fetch root market groups and their children
    var fetchRoots = function (root_ids, shallow_roots) {
        return Promise.props(_.chain(root_ids).map(function (id) {
            var root_group = exports.db_EVE('invMarketGroups').select()
                .where('marketGroupID', '=', id)
                .then(function (rows) {
                    var row = rows[0];
                    if (!row) { return null; }
                    row.children = (shallow_roots) ?
                        countChildren(id) : fetchChildren(id);
                    return Promise.props(row);
                });
            return [id, root_group];
        }).object().value());
    };

    // Utility to fetch children of a market group
    var fetchChildren = function (marketGroupID) {
        return exports.db_EVE('invMarketGroups').select()
            .where('parentGroupID', '=', marketGroupID)
            .then(function (rows) {
                return Promise.props(_.chain(rows).map(function (row) {
                    row.children = (shallow) ?
                        countChildren(row.marketGroupID) :
                        fetchChildren(row.marketGroupID);
                    return [row.marketGroupID, Promise.props(row)];
                }).object().value());
            });
    };

    // Utility to count children of a market group
    var countChildren = function (marketGroupID) {
        return exports.db_EVE('invMarketGroups').select()
            .where('parentGroupID', '=', marketGroupID)
            .count('marketGroupID')
            .then(function (rows) {
                return _.values(rows[0])[0]
            });
    }

    if (root_ids && root_ids.length) {
        // Use the supplied root IDs...
        return fetchRoots(root_ids);
    } else {
        // If no root IDs supplied, look up all groups with no parents.
        return exports.db_EVE('invMarketGroups')
            .select('marketGroupID')
            .whereNull('parentGroupID')
            .then(function (rows) {
                return fetchRoots(_.pluck(rows, 'marketGroupID'), shallow);
            });
    }
};
