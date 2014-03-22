var util = require('util');
var logger = require('winston');
var _ = require('underscore');
var Promise = require('bluebird');
var async = require('async');

var conf = require('../config');
var utils = require('..//utils');
var models = require('../models');
var eveData = require('../eveData');

module.exports = function (app) {

    app.get('/market/items', function (req, res) {
        var out = { };
        res.render('market/items.html', out);
    });

    app.get('/market/orders', function (req, res) {
        var out = { };
        res.render('market/orders.html', out);
    });

    app.get('/market/transactions', function (req, res) {
        var out = { };
        res.render('market/transactions.html', out);
    });

    app.get('/market/type/:typeID', function (req, res) {
        var out = {
            typeID: req.params.typeID
        };
        eveData.invTypes({ typeID: out.typeID }).then(function (types) {
            out.type = types[0];
            res.render('market/type.html', out);
        });
    });

    app.get('/data/market/type/:typeID', function (req, res) {
        models.MarketOrders.forge().query(function (qb) {
            qb.andWhere('typeID', '=', req.params.typeID)
                .andWhere('orderState', '=', 0);
            if ('bid' in req.query) {
                qb.andWhere('bid', '=', req.query.bid);
            }
            if (req.query.solarSystemID) {
                qb.whereIn('solarSystemID',
                    utils.coerceArray(req.query.solarSystemID));
            } else if (req.query.constellationID) {
                qb.whereIn('solarSystemID', function () {
                    this.select('solarSystemID')
                        .from('mapSolarSystems')
                        .whereIn('constellationID',
                            utils.coerceArray(req.query.constellationID));
                });
            } else if (req.query.regionID) {
                qb.whereIn('regionID',
                    utils.coerceArray(req.query.regionID));
            }
        }).fetch().then(function (orders) {
            return orders.joinFromStatic();
        }).then(function (orders) {
            return orders.invoke('toJSON');
        }).then(function (data) {
            res.send(data);
        }).catch(function (err) {
            res.send(500, 'Error: ' + err);
        });
    });

    app.post('/data/market/emuu', function (req, res) {
        var market_data;
        try { market_data = JSON.parse(req.body.data) }
        catch (e) { res.send('0') }
        models.processEmuu(market_data);
        return res.send('1');
    });

    app.get('/data/market/history', function (req, res) {
        if (!req.query.typeID) res.send(400, 'typeID required');
        if (!req.query.regionID) res.send(400, 'regionID required');

        models.MarketHistories.forge().query(function (qb) {
            qb.where('typeID', '=', req.query.typeID)
            .andWhere('regionID', '=', req.query.regionID)
        }).fetch().then(function (histories) {
            res.send(histories.invoke('toJSON'));
        });
    });

    app.get('/data/market/transactions', function (req, res) {
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

    app.get('/data/market/orders', function (req, res) {
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

};
