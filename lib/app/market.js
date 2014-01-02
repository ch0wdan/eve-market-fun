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
        var characters = req.user.characters();
        if (req.query.character) {
            var cid = req.query.character;
            characters = characters.query(function (qb) {
                qb.where('name', '=', cid)
                .orWhere('characterID', '=', cid)
            });
        }
        characters.fetch().then(function (characters) {
            return characters.mapThen(function (character) {
                var orders = character.marketOrders()
                .fetch().then(function (orders) {
                    return orders.joinFromStatic();
                }).then(function (orders) {
                    return orders.invoke('toJSON');
                });
                return Promise.props({
                    character: character.toJSON(),
                    orders: orders
                });
            });
        }).then(function (data) {
            if (req.query.character) {
                return res.send(data[0].orders);
            }
            res.send(data);
            /*
            res.send(_.chain(data).map(function (item) {
                return [item.character.characterID, item];
            }).object().value());
            */
        }).catch(function (err) {
            res.send(500, 'Error: ' + err);
        });
    });

};
