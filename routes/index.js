/*
 * GET home page.
 */
var util = require('util');
var fs = require('fs');
var _ = require('underscore');
var async = require('async');
var CSV = require('csv');
var Knex = require('knex');

var config = require('../config')();

var db_EVE = Knex.initialize({
    client: 'sqlite3',
    connection: {
        filename: 'eve.sqlite'
    }
});

function importCSV (fn, cb) {
    var fields = [];
    var data = [];
    CSV().from.path(fn)
        .on('record', function (row, index) {
            if (0 == index) {
                fields = row;
            } else {
                data.push(_.object(fields, row));
            }
        })
        .on('end', function (count) { cb(null, data); })
        .on('error', function (error) { cb(error, data); });
}

exports.index = function(req, res) {
    var out = {
        title: "EVE Market Fun"
    };
    async.waterfall([
        function (next) {
            fs.readdir(config.marketlogs_path, next);
        },
        function (files, next) {
            var order_fn = _.chain(files)
                .filter(function (f) { return 0 === f.indexOf('My Orders') })
                .sortBy().reverse()
                .first().value();
            importCSV(config.marketlogs_path + '/' + order_fn, next);
        },
        function (orders, next) {
            async.each(orders, function (order, e_next) {
                util.debug(util.inspect(order.typeID));
                db_EVE('invTypes')
                    .select('typeName')
                    .where('typeID', order.typeID)
                    .then(function (rows) {
                        if (rows.length) {
                            order.typeName = rows[0].typeName;
                        }
                        e_next();
                    });
            }, function (err) {
                out.orders = _.chain(orders)
                    .sortBy('typeName')
                    .map(function (i) {
                        i.bidLabel = ('True' === i.bid) ? 'Buy' : 'Sell';
                        return i;
                    })
                    .groupBy('bidLabel')
                    .value();
                next();
            })
        }
    ], function (err) {
        res.render('index', out);
    });
};
