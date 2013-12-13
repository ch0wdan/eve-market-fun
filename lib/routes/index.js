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

    var user, character;

    models.User.forge({username: username}).fetch({require: true})
    .then(function (user) {
        out.user = user;
        return user.characters()
            .query({where: {name: character_name}})
            .fetchOne({withRelated: ['apiKey'], require: true});
    }).then(function (character) {
        out.character = character;
        return character.marketOrders()
            .query({where: {orderState: 0}})
            .fetch();
    }).then(function (orders) {
        return orders.joinFromStatic();
    }).then(function (orders) {
        out.orders = orders.chain().map(function (order) {
            order = order.toJSON();
            order.bidType = (['1', 'True'].indexOf(order.bid) !== -1) ?
                'buy': 'sell';
            return order;
        }).sortBy('typeName').groupBy('bidType').value();
    }).catch(function (e) {
        util.debug(e);
    }).finally(function () {
        res.render('index', out);
    });
};
