var util = require('util');
var _ = require('underscore');
var async = require('async');
var assert = require('chai').assert;
var routes = require('../lib/routes');
var Knex = require('knex');
var Bookshelf = require('bookshelf');

var logger = require('winston');

var conf = require('../lib/config');

suite('Routes', function() {

    test("index route is defined", function() {
        assert.isDefined(routes.index);
    })

    /*
    test("evedb play", function (done) {

        var evedb = Knex.initialize({
            client: 'sqlite3',
            connection: {
                filename: conf.get('eve_sqlite')
            }
        });

        evedb('invNames')
            .select()
            .limit(10)
            .then(function (rows) {
                util.debug(util.inspect(rows));
                done();
            });
    });

    test("orders-export", function (done) {
        var csv = require('csv');

        function importCSV (fn, cb) {
            var fields = [];
            var data = [];
            csv().from.path(fn)
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

        var orders, details;
        async.waterfall([
            function (next) {
                importCSV('marketlogs/My Orders-2013.12.10 1818.txt', function (err, data) {
                    orders = data;
                    next();
                });
            },
            function (next) {
                importCSV('marketlogs/Sinq Laison-100MN Microwarpdrive II-2013.12.10 183604.txt', function (err, data) {
                    details = data;
                    next();
                });
            },
            function (next) {
                var idx_details = {};
                for (var i=0; i<details.length; i++) {
                    idx_details[details[i].orderID] = details[i];
                }
                for (var j=0, order; order=orders[j]; j++) {
                    if (!idx_details[order.orderID]) continue;
                    util.debug("ORDER " + util.inspect(order));
                    util.debug("DETAILS " + util.inspect(idx_details[order.orderID]));
                }
                next()
            }
        ], function (err) {
            done(); 
        });
    });

    test("evebs play", function (done) {
        var EVE = Bookshelf.initialize({
            client: 'sqlite3',
            connection: {
                filename: conf.get('eve_sqlite')
            }
        });

        var ItemName = EVE.Model.extend({
            tableName: 'invNames'
        });

        new ItemName({itemID: 1})
            .fetch()
            .then(function (m) {
                util.debug(m);
                util.debug(m.get('itemName'));
                done();
            });

    });
    */

})
