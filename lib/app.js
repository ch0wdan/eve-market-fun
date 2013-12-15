/**
 * Module dependencies.
 */
var util = require('util');
var http = require('http');
var path = require('path');
var fs = require('fs');

var express = require('express');
var _ = require('underscore');
var async = require('async');
var nunjucks = require('nunjucks');
var CSV = require('csv');
var Promise = require('bluebird');
var Knex = require('knex');

var logger = require('winston');

var conf = require('./config');
var Bookshelf = require('bookshelf');
Bookshelf.db_Main = Bookshelf.initialize(conf.get('database'));
var models = require('./models');
var eveData = require('./eveData');

var app = express();

// all environments
app.set('port', conf.get('port'))
    .set('views', path.join(__dirname, '../views'))
    .use(express.favicon())
    .use(express.logger('dev'))
    .use(express.json())
    .use(express.urlencoded())
    .use(express.methodOverride())
    .use(express.cookieParser())
    .use(express.session({secret: '8675309jenny2'}))
    .use(app.router)
    .use(express.static(path.join(__dirname, '../public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

nunjucks.configure('views', {
    autoescape: true,
    express: app
});
    
app.get('/', function(req, res) {
    var username = 'lmorchard';
    var character_name = 'Pham Vrinimi';

    var out = {
        title: "EVE Market Fun",
        orders: {
            sell: [],
            buy: []
        }
    };

    res.render('index.html', out);
});

app.get('/data/orders.json', function (req, res) {
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
});

app.get('/data/invMarketGroups', function (req, res) {
    eveData.invMarketGroups(req.query.root, ('shallow' in req.query))
    .then(function (results) {
        res.send(results);
    }).catch(function (e) {
        res.send({});
    });
});

app.get('/data/invMarketGroupIDs', function (req, res) {
    eveData.invMarketGroupIDs(req.query.root)
        .then(function (results) {
            res.send(results)
        });
});

app.get('/data/invTypes', function (req, res) {
    eveData.invTypes(req.query).then(function (rows) {
        res.send(rows); 
    }).catch(function (e) {
        util.debug("WHA " + e);
    });
});

module.exports = function () {
    http.createServer(app).listen(app.get('port'), function(){
      logger.info('Express server listening on port ' + app.get('port'));
    });
};
