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
                var orders = character.marketOrders().fetch()
                .then(function (orders) {
                    return orders.joinFromStatic();
                }).then(function (orders) {
                    return orders.invokeThen('toJSON');
                });
                return Promise.props({
                    character: character.toJSON(),
                    orders: orders
                });
            });
        }).then(function (data) {
            // Index the character/order records by character ID.
            res.send(_.chain(data).map(function (item) {
                return [item.character.characterID, item];
            }).object().value());
        }).catch(function (err) {
            res.send(500, 'Error: ' + err);
        });
    });

    app.post('/data/market/emuu', function (req, res) {
        var market_data;
        try { market_data = JSON.parse(req.body.data) }
        catch (e) { res.send('0') }

        if (market_data.resultType == 'orders') {
            _.chain(market_data.rowsets).map(function (rowset) {
                var row_defaults = {
                    typeID: rowset.typeID,
                    orderState: 0
                };
                return _.map(rowset.rows, function (row) {
                    return _.chain(market_data.columns).object(row)
                        .defaults(row_defaults).value();
                });
            }).flatten().each(function (row) {
                models.MarketOrders.updateQueue.push(row);
            });
            return res.send('1');
        }

        return res.send('1');
    });

};
