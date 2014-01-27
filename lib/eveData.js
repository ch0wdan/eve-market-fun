var util = require('util');

var _ = require('underscore');
var uuid = require('node-uuid');

var conf = require(__dirname + '/config');
var logger = require('winston');

var Promise = require('bluebird');
var Knex = require('knex');

var utils = require('./utils');

exports.db_EVE = null;

exports.mapRegions = function (opts) {
    var query = exports.db_EVE('mapRegions').select();
    if (opts.regionID) {
        return query.where('regionID', '=', opts.regionID);
    }
    return query;
};

exports.mapConstellations = function (opts) {
    var query = exports.db_EVE('mapConstellations').select();
    if (opts.regionID) {
        query.whereIn('regionID', utils.coerceArray(opts.regionID));
    }
    return query;
};

exports.mapSolarSystems = function (opts) {
    var query = exports.db_EVE('mapSolarSystems').select();
    if (opts.regionID) {
        query.whereIn('regionID', utils.coerceArray(opts.regionID));
    }
    if (opts.constellationID) {
        query.whereIn('constellationID', utils.coerceArray(opts.constellationID));
    }
    return query;
};

exports.invTypes = function (opts) {
    var query = exports.db_EVE('invTypes')
        .join('invGroups', 'invTypes.groupID', '=', 'invGroups.groupID', 'left')
        .join('invCategories', 'invGroups.categoryID', '=', 'invCategories.categoryID', 'left')
        .join('invMetaTypes', 'invTypes.typeID', '=', 'invMetaTypes.typeID', 'left')
        .join('invMetaGroups', 'invMetaTypes.metaGroupID', '=', 'invMetaGroups.metaGroupID', 'left')
        .join('dgmTypeAttributes as attrMetaLevel', function () {
            this.on('attrMetaLevel.attributeID', '=', 633);
            this.on('attrMetaLevel.typeID', '=', 'invTypes.typeID');
        }, 'left')
        .join('dgmTypeAttributes as attrTechLevel', function () {
            this.on('attrTechLevel.attributeID', '=', 422);
            this.on('attrTechLevel.typeID', '=', 'invTypes.typeID');
        }, 'left')
        .select(exports.db_EVE.raw([
            'invGroups.groupName',
            'invCategories.categoryName',
            'invMetaGroups.metaGroupName',
            'coalesce(attrMetaLevel.valueInt, attrMetaLevel.valueFloat) as metaLevel',
            'coalesce(attrTechLevel.valueInt, attrTechLevel.valueFloat) as techLevel',
            'invTypes.*'
        ].join(',')))
        .where('invTypes.published', '=', 1); // TODO: option?

    var mungeRows = function (rows) {

        rows = _.map(rows, function (row) {
            
            // Meta 0 has no real metaGroupName, but I want to pretend
            if (row.metaLevel == 0) {
                row.metaGroupID = 1;
                row.metaGroupName = 'Tech I';
            }

            return row;
        });

        // HACK: Because I can't seem to get whereIn() to work twice
        if (opts.metaGroupID) {
            if (!_.isArray(opts.metaGroupID)) {
                opts.metaGroupID = [ opts.metaGroupID ];
            }
            if (opts.metaGroupID.length) {
                rows = _.filter(rows, function (row) {
                    return opts.metaGroupID.indexOf(''+row.metaGroupID) !== -1;
                });
            }
        }

        // HACK: Because I can't seem to get whereIn() to work twice
        if (opts.metaLevel) {
            if (!_.isArray(opts.metaLevel)) {
                opts.metaLevel = [ opts.metaLevel ];
            }
            if (opts.metaLevel.length) {
                rows = _.filter(rows, function (row) {
                    return opts.metaLevel.indexOf(''+row.metaLevel) !== -1;
                });
            }
        }

        // HACK: Because I can't seem to get whereIn() to work twice
        if (opts.techLevel) {
            if (!_.isArray(opts.techLevel)) {
                opts.techLevel = [ opts.techLevel ];
            }
            if (opts.techLevel.length) {
                rows = _.filter(rows, function (row) {
                    return opts.techLevel.indexOf(''+row.techLevel) !== -1;
                });
            }
        }

        return rows;
    }

    if (opts.typeID) {
        if (!_.isArray(opts.typeID)) {
            opts.typeID = [ opts.typeID ];
        }
        return query.whereIn('invTypes.typeID', opts.typeID).then(mungeRows);
    }
    
    if (opts.marketGroupID) {
        return exports.invMarketGroupIDs(opts.marketGroupID)
            .then(function (ids) {
                return query.whereIn('invTypes.marketGroupID', ids).then(mungeRows);
            });
    }

    return query.then(mungeRows);

    throw "No defined filtering options supplied";
};

// Meta groups that match items
exports.invMetaGroups = function () {
    return exports.db_EVE('invMetaGroups')
        .select(exports.db_EVE.raw([
            'invMetaGroups.metaGroupID',
            'invMetaGroups.metaGroupName',
            'count(invTypes.typeID) as invTypesCount'
        ].join(',')))
        .join('invMetaTypes', 'invMetaTypes.metaGroupID', '=', 'invMetaGroups.metaGroupID')
        .join('invTypes', 'invTypes.typeID', '=', 'invMetaTypes.typeID')
        .groupBy('invMetaGroups.metaGroupID');
}

// Meta levels that match items
exports.invMetaLevels = function () {
    return exports.db_EVE('invTypes')
        .join('dgmTypeAttributes as attrMetaLevel', function () {
            this.on('attrMetaLevel.attributeID', '=', 633);
            this.on('attrMetaLevel.typeID', '=', 'invTypes.typeID');
        }, 'left')
        .select(exports.db_EVE.raw([
            'coalesce(attrMetaLevel.valueFloat,attrMetaLevel.valueInt) as metaLevel',
            'count(invTypes.typeID) as invTypesCount'
        ].join(',')))
        .groupBy('metaLevel')
        .where('invTypes.published', '=', 1);
}

// Recursively look up market group children for a given set of IDs
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
