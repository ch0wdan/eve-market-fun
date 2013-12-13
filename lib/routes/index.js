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

var db_EVE = Knex.initialize({
    client: 'sqlite3',
    connection: {
        filename: conf.get('eve_sqlite')
    }
});

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

    models.User.forge({username: username})
        .fetch({require: true})
        .then(function (user) {
            out.user = user;
            return user.characters()
                .query({where: {name: character_name}})
                .fetchOne({withRelated: ['apiKey'], require: true});
        })
        .then(function (character) {
            out.character = character;
            return character.marketOrders()
                .query({where: {orderState: 0}})
                .fetch();
        })
        .then(function (orders) {
            return orders.mapThen(function (order) {
                order = order.toJSON();
                return db_EVE('invTypes').select('typeName')
                    .where('typeID', order.typeID)
                    .then(function (rows) {
                        if (rows.length) {
                            order.typeName = rows[0].typeName;
                        }
                        out.orders[order.bid == 1 ? 'buy' : 'sell'].push(order);
                    });
            });
        })
        .catch(function (e) {
            util.debug(e);
        })
        .finally(function () {
            res.render('index', out);
        });
};
