process.env.NODE_ENV = 'test';

var util = require('util');
var fs = require('fs');

var _ = require('underscore');
var async = require('async');
var expect = require('chai').expect;
var Promise = require('bluebird');
var requestReal = require('request');
var request = Promise.promisify(requestReal);

var logger = require('winston');

var conf = require('../lib/config');

var fixtures_path = __dirname + '/fixtures/';

var testUtils = require(__dirname + '/lib/index.js');
var models = require('../lib/models');
var appServer = require('../lib/app');

var TEST_PORT = parseInt(5252 + 100 * Math.random());
var BASE_URL = 'http://localhost:' + TEST_PORT;

var emdr_orders = require(fixtures_path + 'emdr-orders.json');
var emdr_history = require(fixtures_path + 'emdr-history.json');

describe('HTTP API', function () {
    this.timeout(25000);

    var auth_jars = {};
    var server = null;

    before(function (done) {
        testUtils.migrateDB().then(function () {
            return appServer({port: TEST_PORT});
        }).then(function (server_in) {
            server = server_in;
            return testUtils.setupUsers();
        }).then(function (users) {
            return testUtils.loginUsers(BASE_URL);
        }).then(function (jars) {
            auth_jars = jars;
            return done();
        });
    });

    after(function (done) {
        server.close(function () {
            return done();
        });
    });

    describe('Static', function () {

        describe('/data/invTypes', function () {
            it('should yield expected item data', function (done) {
                request({
                    url: BASE_URL + '/data/invTypes?typeID=594',
                    json: true
                }).spread(function (resp, body) {
                    expect(body.length).to.equal(1);
                    var result = body[0];
                    expect(result.groupName).to.equal('Frigate');
                    expect(result.typeName).to.equal('Incursus');
                    return done();
                });
            });
        });

    });

    describe('Market', function () {

        describe('/data/market/type/:typeID', function () {

            var fixture1_fn = fixtures_path +
                'My Orders-2014.07.20 1732.txt'
            var fixture2_fn = fixtures_path +
                'Sinq Laison-720mm Scout Artillery I-2014.07.20 174402.txt';

            var expected_typeid = 9451;
            var expected_regionid = 10000032;
            var expected_charid = 8675309;
            var character_orders = [3671812676, 3662398179];
            var anon_orders = [3664240604, 3662402904, 3509494868];

            var request_opts;

            beforeEach(function (done) {
                request_opts = {
                    url: BASE_URL + '/data/market/type/' + expected_typeid,
                    json: true,
                    jar: auth_jars['traderjoe'],
                    qs: { regionID: expected_regionid }
                };
                Promise.all([
                    conf.db_Main('MarketOrders').truncate(),
                    conf.db_Main('MarketDataRaw').truncate()
                ]).then(function () {
                    return done();
                })
            });

            it('should list orders from raw market data', function (done) {
                var expected = [];
                var fin = fs.createReadStream(fixture2_fn);

                models.MarketDataRaws.forge().updateFromCSV(fin)
                .then(function (updates) {
                    return request(request_opts);
                }).spread(function (resp, orders) {
                    expect(orders.length).to.equal(63);
                    var ids = orders.map(function (order) {
                        return parseInt(order.orderID);
                    });
                    expect(ids).to.include.members(anon_orders);
                    orders.forEach(function (order) {
                        expect(order.charID).to.be.undefined;
                    });
                    return done();
                });
            });

            it('should list orders from a character', function (done) {
                var expected =
                    [ { orderID: 3662398179,
                        charID: 8675309,
                        stationID: 60011866,
                        issueDate: '2014-07-19 04:43:03.000',
                        price: 2500002.11,
                        volEntered: 50,
                        volRemaining: 48,
                        bid: true },
                      { orderID: 3671812676,
                        charID: 8675309,
                        stationID: 60011866,
                        issueDate: '2014-07-20 04:56:22.000',
                        price: 5699988.7,
                        volEntered: 1,
                        volRemaining: 1,
                        bid: false } ];

                var fin = fs.createReadStream(fixture1_fn);
            
                models.MarketOrders.forge().updateFromCSV(fin)
                .then(function (updates) {
                    return request(request_opts);
                }).spread(function (resp, orders) {
                    expect(orders.length).to.equal(2);
                    var result = orders.map(function (order) {
                        return _.pick(order, [
                            'orderID', 'charID', 'stationID', 'issueDate', 'price',
                            'volEntered', 'volRemaining', 'bid'
                        ]);
                    });
                    expect(result).to.deep.equal(expected);
                    return done();
                })
            });

            it('should only list orders from characters belonging to the authd user', function (done) {
                expect(false).to.be.true;
                return done();
            });

            describe('Combined orders from character and market', function () {

                beforeEach(function (done) {
                    var fin1 = fs.createReadStream(fixture1_fn);
                    var fin2 = fs.createReadStream(fixture2_fn);
                    Promise.all([
                        models.MarketOrders.forge().updateFromCSV(fin1),
                        models.MarketDataRaws.forge().updateFromCSV(fin2)
                    ]).spread(function (order_updates, raw_updates) {
                        return done();
                    });
                });

                function ensureParams(params, count, assertion) {
                    return function (done) {
                        request_opts.qs = params;
                        request(request_opts).spread(function (resp, orders) {
                            var ids = orders.map(function (order) {
                                return parseInt(order.orderID);
                            });
                            expect(orders.length).to.equal(count);
                            if (assertion) { assertion(orders, ids); }
                            return done();
                        });
                    };
                }

                it('should list all orders', ensureParams({
                    regionID: expected_regionid
                }, 63, function (orders, ids) {
                    expect(ids).to.include.members(character_orders);
                    expect(ids).to.include.members(anon_orders);
                    orders.forEach(function (order) {
                        var orderID = parseInt(order.orderID);
                        if (character_orders.indexOf(orderID) !== -1) {
                            expect(order.charID).to.equal(expected_charid);
                        } else {
                            expect(order.charID).to.be.undefined;
                        }
                    });
                }));

                it('should properly handle ?bid=1', ensureParams({
                    bid: 1, regionID: expected_regionid
                }, 33, function (orders) {
                    orders.forEach(function (order) {
                        expect(order.bid).to.be.true;
                    });
                }));

                it('should properly handle ?bid=0', ensureParams({
                    bid: 0, regionID: expected_regionid
                }, 30, function (orders) {
                    orders.forEach(function (order) {
                        expect(order.bid).to.be.false;
                    });
                }));
                
                it('should properly handle ?solarSystemID=30002674', ensureParams({
                    solarSystemID: 30002674
                }, 1, function (orders) {
                    expect(orders[0].orderID).to.equal('3563560754');
                }));

                it('should properly handle ?solarSystemID=30002659', ensureParams({
                    solarSystemID: 30002659
                }, 61, function (orders) {
                    orders.forEach(function (order) {
                        expect(order.orderID).to.not.equal('3563560754');
                    });
                }));

                it('should properly handle ?stationID=60009364', ensureParams({
                    stationID: 60009364
                }, 1, function (orders) {
                    expect(orders[0].orderID).to.equal('3563560754');
                }));

                it('should properly handle ?stationID=60011866', ensureParams({
                    stationID: 60011866
                }, 61, function (orders) {
                    orders.forEach(function (order) {
                        expect(order.orderID).to.not.equal('3563560754');
                    });
                }));

            });

        });

        describe('/data/market/orders', function () {
            it('should offer all market orders for a character', function (done) {
                expect(false).to.be.true;
                return done();
            });
        });

        describe('/data/market/history', function () {
            it('should offer market history for an item', function (done) {
                expect(false).to.be.true;
                return done();
            });
        });

        describe('/data/market/transactions', function () {
            it('should offer transaction history for a character', function (done) {
                expect(false).to.be.true;
                return done();
            });
            it('should offer transaction history for a character by item', function (done) {
                expect(false).to.be.true;
                return done();
            });
        });

        describe('/data/market/emuu', function () {
            it('should accept POSTed updates in EMUU format', function (done) {
                expect(false).to.be.true;
                return done();
            });
        });

        describe('/data/market/margins', function () {
            it('should offer station trading margin suggestions', function (done) {
                expect(false).to.be.true;
                return done();
            });
        });

        describe('/data/market/trades', function () {
            it('should offer trading leads between hubs', function (done) {
                expect(false).to.be.true;
                return done();
            });
        });

    });

});
