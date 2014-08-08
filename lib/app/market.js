var util = require('util');
var logger = require('winston');
var _ = require('underscore');
var Promise = require('bluebird');
var async = require('async');

var conf = require('../config');
var utils = require('../utils');
var models = require('../models');
var eveData = require('../eveData');

module.exports = function (app) {

    app.get('/market/type/:typeID', app.loginRequired, function (req, res) {
        var out = {
            typeID: req.params.typeID
        };
        eveData.invTypes(out).then(function (types) {
            out.type = types[0];
            res.render('market/type.html', out);
        });
    });
    
    app.get('/market/station/:stationID', app.loginRequired, function (req, res) {
        var out = {
            stationID: req.params.stationID
        };
        eveData.staStations(out).then(function (stations) {
            out.station = stations[0];
            res.render('market/station.html', out);
        });
    });
    
    app.get('/market/itembrowser', app.loginRequired, function (req, res) {
        var out = { };
        res.render('market/itembrowser.html', out);
    });

    app.get('/market/items', app.loginRequired, function (req, res) {
        var out = { };
        res.render('market/items.html', out);
    });

    app.get('/market/orders', app.loginRequired, function (req, res) {
        var out = { };
        res.render('market/orders.html', out);
    });

    app.get('/market/transactions', app.loginRequired, function (req, res) {
        var out = { };
        res.render('market/transactions.html', out);
    });

    app.get('/market/trades', app.loginRequired, function (req, res) {
        var out = { };
        res.render('market/trades.html', out);
    });

    //////////////////////////////////////////////////////////////////////

    app.post('/data/market/emuu', app.loginRequired, function (req, res) {
        var market_data;
        try { market_data = JSON.parse(req.body.data) }
        catch (e) { res.send('0') }
        models.processEmuu(market_data);
        return res.send('1');
    });

    app.get('/data/market/type/:typeID', app.loginRequired, function (req, res) {
        if (!(req.query.regionID || req.query.constellationID ||
                req.query.solarSystemID || req.query.stationID)) {
            return res.send(400,
                'regionID, constellationID, solarSystemID, or stationID required');
        }

        req.query.typeID = req.params.typeID; 
        models.MarketOrders.forge().queryWithRaw(req.query).then(function (data) {
            res.send(data);
        }).catch(function (err) {
            res.send(500, 'Error: ' + err);
        });
    });

    app.get('/data/market/margins', app.loginRequired, function (req, res) {
        var filters = ['typeID', 'regionID', 'solarSystemID', 'stationID'];
        
        var found_filter = false;
        filters.forEach(function (name) {
            if (req.query[name]) { found_filter = true; }
        });
        if (!found_filter) {
            res.send(400, 'At least one of ' + filters.join(', ') + ' required');
        }

        models.MarketMargins.forge().query(function (qb) {
            filters.forEach(function (name) {
                var filter = utils.coerceArray(req.query[name]);
                if (filter.length) {
                    qb.whereIn(name, filter);
                }
            });
        }).fetch().then(function (margins) {
            return margins.joinFromStatic();
        }).then(function (margins) {
            var margins_json = margins.toJSON();

            var history_criteria = _.reduce(margins_json, function (memo, margin) {
                memo.regionID[margin.regionID] = true;
                memo.typeID[margin.typeID] = true;
                return memo;
            }, { regionID: {}, typeID: {} });

            models.MarketHistoryAggregates.forge().query(function (qb) {
                qb.whereIn('regionID', _.keys(history_criteria.regionID));
                qb.whereIn('typeID', _.keys(history_criteria.typeID));
            }).fetch().then(function (history) {
                var history_map = {};
                history.forEach(function (h) {
                    h = h.toJSON();
                    history_map[h.typeID + ':' + h.regionID] = h;
                });
                margins_json.forEach(function (margin) {
                    var history = history_map[margin.typeID + ':' + margin.regionID];
                    if (history) {
                        _.extend(margin, _.pick(history, [
                            'avgDailyVolume', 'avgDailyVolumeForMonth',
                            'avgDailyVolumeForWeek', 'volatility',
                            'volatilityForMonth', 'volatilityForWeek'
                        ]));
                        margin.marginByVolume = margin.baseMargin * margin.avgDailyVolumeForMonth;
                    } else {
                        margin.marginByVolume = 0;
                    }
                });
                res.send(margins_json);
            });
        }).catch(function (err) {
            res.send(500, 'Error: ' + err);
        });
    });

    app.get('/data/market/history', app.loginRequired, function (req, res) {
        if (!req.query.typeID) res.send(400, 'typeID required');
        if (!req.query.regionID) res.send(400, 'regionID required');

        models.MarketHistories.forge().query(function (qb) {
            qb.where('typeID', '=', req.query.typeID)
            .andWhere('regionID', '=', req.query.regionID)
        }).fetch().then(function (histories) {
            res.send(histories.invoke('toJSON'));
        }).catch(function (err) {
            res.send(500, 'Error: ' + err);
        });
    });

    app.get('/data/market/transactions', app.loginRequired, function (req, res) {
        if (!req.query.character) {
            return res.send(400, 'character required');
        }
        req.user.characters().query(function (qb) {
            var cid = req.query.character;
            qb.where('name', '=', cid).orWhere('characterID', '=', cid)
        }).fetchOne({require: true}).then(function (character) {
            return character.transactions().query(function (qb) {
                qb.orderBy('transactionDateTime', 'desc')
                    .limit(req.query.limit || 100);
                if ('offset' in req.query) {
                    qb.offset(req.query.offset);
                }
                if ('typeID' in req.query) {
                    qb.where('typeID', '=', req.query.typeID);
                }
                if ('typeName' in req.query) {
                    qb.where('typeName', '=', req.query.typeName);
                }
            }).fetch();
        }).then(function (orders) {
            var orders_out = orders.invoke('toJSON');
            _.each(orders_out, function (order) {
                var sign = (order.transactionType == 'buy') ? -1 : 1;
                order.credit = sign * order.price * order.quantity;
            });
            return orders_out;
        }).then(function (data) {
            res.send(data);
        }).catch(function (err) {
            res.send(500, 'Error: ' + err);
        });
    });

    app.get('/data/market/orders', app.loginRequired, function (req, res) {
        var orders;

        if (req.query.character) {
            var cid = req.query.character;
            orders = req.user.characters().query(function (qb) {
                qb.where('name', '=', cid)
                .orWhere('characterID', '=', cid)
            }).fetchOne({require: true}).then(function (character) {
                return character.marketOrders().query(function (qb) {
                    qb.where('orderState', '=', '0')
                    .andWhere('bid', '=', '0')
                }).fetch();
            });
        } else {
            return res.send(400,
                'characterID, or typeID and regionID required');
        }

        orders.then(function (orders) {
            return orders.joinFromStatic();
        }).then(function (orders) {
            return orders.invoke('toJSON');
        }).then(function (data) {
            res.send(data);
        }).catch(function (err) {
            res.send(500, 'Error: ' + err);
        });
    });

    app.get('/data/market/trades', app.loginRequired, function (req, res) {

        var from_station = 60004588;
        var from_bid = 0;
        var to_station = 60003760;
        var to_bid = 1;

        var db_Main = models.db_Main;

        db_Main('MarketTradeLeads').select(
            'MarketTradeLeads.updated_at',
            'MarketTradeLeads.typeID',
            'invTypes.typeName',
            'invTypes.volume',
            'MarketTradeLeads.baseMarginPercent',
            'MarketTradeLeads.baseMargin',
            'fs.stationID as fromStationID',
            'fs.stationName as fromStationName',
            'MarketTradeLeads.fromSolarSystemID',
            'fmss.solarSystemName as fromSolarSystemName',
            'fmo.price as fromPrice',
            'fmo.updated_at as fromUpdatedAt',
            'ts.stationID as toStationID',
            'ts.stationName as toStationName',
            'MarketTradeLeads.toSolarSystemID',
            'tmss.solarSystemName as toSolarSystemName',
            'tmo.price as toPrice',
            'tmo.updated_at as toUpdatedAt'
        )
        .join('invTypes', 'invTypes.typeID', '=', 'MarketTradeLeads.typeID', 'left')
        .join('mapSolarSystems as fmss', 'fmss.solarSystemID', '=', 'MarketTradeLeads.fromSolarSystemID', 'left')
        .join('staStations as fs', 'fs.stationID', '=', 'MarketTradeLeads.fromStationID', 'left')
        .join('MarketOrders as fmo', 'fmo.orderID', '=', 'fromTopOrderID')
        .join('mapSolarSystems as tmss', 'tmss.solarSystemID', '=', 'MarketTradeLeads.toSolarSystemID', 'left')
        .join('staStations as ts', 'ts.stationID', '=', 'MarketTradeLeads.toStationID', 'left')
        .join('MarketOrders as tmo', 'tmo.orderID', '=', 'toTopOrderID')
        .where({
            fromStationID: from_station, fromBid: from_bid,
            toStationID: to_station, toBid: to_bid
        })
        .where('baseMarginPercent', '>', 0)
        .whereNotNull('fmo.orderID')
        .whereNotNull('tmo.orderID')
        .whereNotNull('MarketTradeLeads.fromRegionID')
        .whereNotNull('MarketTradeLeads.toRegionID')
        .whereRaw('MarketTradeLeads.updated_at > date_sub(now(), interval 3 hour)')
        .whereRaw('fmo.updated_at > date_sub(now(), interval 3 hour)')
        .whereRaw('tmo.updated_at > date_sub(now(), interval 3 hour)')
        .orderBy('baseMargin', 'desc')
        .limit(100)
        .then(function (data) {
            res.send(data);
        }).catch(function (err) {
            res.send(500, 'Error: ' + err);
        });

    });

};
