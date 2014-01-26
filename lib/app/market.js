var util = require('util');
var logger = require('winston');
var _ = require('underscore');
var Promise = require('bluebird');

var conf = require('../config');
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

    app.get('/market/type/:typeID', function (req, res) {
        var out = {
            typeID: req.params.typeID
        };
        res.render('market/type.html', out);
    });

    app.get('/data/market/type/:typeID', function (req, res) {
        models.MarketOrders.forge().query(function (qb) {
            qb.where('typeID', '=', req.params.typeID);
            if ('bid' in req.query) {
                qb.andWhere('bid', '=', req.query.bid);
            }
            if (req.query.regionID) {
                qb.andWhere('regionID', '=', req.query.regionID)
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

    app.get('/data/market/orders', function (req, res) {
        var orders;

        if (req.query.character) {
            var cid = req.query.character;
            orders = req.user.characters().query(function (qb) {
                qb.where('name', '=', cid)
                .orWhere('characterID', '=', cid)
            }).fetchOne({require: true}).then(function (character) {
                return character.marketOrders().fetch();
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
