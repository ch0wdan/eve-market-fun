/*
 * GET home page.
 */
var util = require('util');
var fs = require('fs');
var _ = require('underscore');
var async = require('async');
var CSV = require('csv');
var Knex = require('knex');

var conf = require('../config');

var Bookshelf = require('bookshelf');
Bookshelf.db_Main = Bookshelf.initialize(conf.get('database'));

var models = require('../models');

exports.hello = function (req, res) {
    res.writeHead(200, {'Content-Type': "text/plain"});
    res.write("HELLO");
    res.end();
};

exports.index = function(req, res) {
    var username = 'lmorchard';
    var character_name = 'Pham Vrinimi';

    var out = {
        title: "EVE Market Fun",
        orders: {
            sell: [],
            buy: []
        }
    };

    res.render('index', out);
};

exports.orders_json = function (req, res) {
    var orders_type = (req.param('type') == 'buy') ? 'buy' : 'sell';

    var username = 'lmorchard';
    var character_name = 'Pham Vrinimi';

    var out = {
        orders: {
            sell: [],
            buy: []
        }
    };

    var user, character;

    models.User.forge({username: username}).fetch({require: true})
    .then(function (user) {
        //out.user = user.toJSON();
        return user.characters()
            .query({where: {name: character_name}})
            .fetchOne({withRelated: ['apiKey'], require: true});
    }).then(function (character) {
        //out.character = character.toJSON();
        return character.marketOrders()
            .query({where: {orderState: 0}})
            .fetch();
    }).then(function (orders) {
        return orders.joinFromStatic();
    }).then(function (orders) {
        out.orders = orders.chain().map(function (order) {
            order = order.toJSON();
            _.each(['price', 'volEntered', 'volRemaining'], function (name) {
                order[name] = parseFloat(order[name]);
            });
            order.bidType = (['1', 'True'].indexOf(order.bid) !== -1) ?
                'buy': 'sell';
            return order;
        }).sortBy('typeName').groupBy('bidType').value();
    }).catch(function (e) {
        util.debug(e);
    }).finally(function () {
        res.send(out.orders[orders_type]);
    });
};
