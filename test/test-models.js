process.env.NODE_ENV = 'test';

var util = require('util');
var fs = require('fs');

var _ = require('underscore');
var async = require('async');
var expect = require('chai').expect;
var Promise = require('bluebird');
var Knex = require('knex');

var logger = require('winston');

var conf = require('../lib/config');
var testUtils = require(__dirname + '/lib/index.js');

var fixtures_path = __dirname + '/fixtures/';

var models = require('../lib/models');

describe("Models", function () {
    this.timeout(5000);

    var emdr_orders = require(fixtures_path + 'emdr-orders.json');
    var emdr_history = require(fixtures_path + 'emdr-history.json');

    before(function (done) {
        testUtils.migrateDB().finally(done);
    });

    describe("MarketOrders", function () {

        var MarketOrders;

        beforeEach(function (done) {
            conf.db_Main('MarketOrders').truncate().then(function () {
                MarketOrders = models.MarketOrders.forge();
            })
            .finally(done);
        });

        it('should update character orders from CSV export', function (done) {
            var fixture_fn = fixtures_path + 'My Orders-2014.07.20 1732.txt';
            var expected_typeid = 9451;
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

            var fin = fs.createReadStream(fixture_fn);

            MarketOrders.updateFromCSV(fin).then(function (updates) {
                expect(updates.length).to.equal(124);
                return models.MarketOrders.forge().query(function (qb) {
                    qb.where('typeID', '=', expected_typeid);
                }).fetch();
            }).then(function (orders) {
                expect(orders.length).to.equal(2);
                var result = orders.toJSON().map(function (order) {
                    return _.pick(order, [
                        'orderID', 'charID', 'stationID', 'issueDate', 'price',
                        'volEntered', 'volRemaining', 'bid'
                    ]);
                });
                expect(result).to.deep.equal(expected);
                return done();
            });
        });
    
        describe("MarketOrder", function () {

        });
    
    });

    describe("MarketDataRaws", function () {

        var MarketDataRaws;

        beforeEach(function (done) {
            conf.db_Main('MarketDataRaw').truncate().then(function () {
                MarketDataRaws = models.MarketDataRaws.forge();
                return MarketDataRaws.updateFromEMDR(emdr_orders);
            })
            .then(function (objs) {
                return MarketDataRaws.updateFromEMDR(emdr_history);
            })
            .finally(done);
        });

        it('should update regional orders from CSV export', function (done) {
            var fixture_fn = fixtures_path + 'Placid-Prototype Sensor Booster-2014.07.13.txt';
            var expected =
                [ { orderID: '3655075685',
                    typeID: '6158',
                    regionID: '10000048',
                    stationID: '60011893',
                    solarSystemID: '30003794',
                    issueDate: new Date('Thu Jul 10 2014 23:45:05 GMT-0400 (EDT)'),
                    duration: '30',
                    price: 339999.99,
                    range: '32767',
                    volEntered: 7,
                    volRemaining: 2,
                    minVolume: '1',
                    bid: false },
                  { orderID: '3603322664',
                    typeID: '6158',
                    regionID: '10000048',
                    stationID: '60011824',
                    solarSystemID: '30003830',
                    issueDate: new Date('Tue Jun 17 2014 15:55:57 GMT-0400 (EDT)'),
                    duration: '90',
                    price: 344000,
                    range: '32767',
                    volEntered: 1384,
                    volRemaining: 1305,
                    minVolume: '1',
                    bid: false },
                  { orderID: '3620758551',
                    typeID: '6158',
                    regionID: '10000048',
                    stationID: '60011824',
                    solarSystemID: '30003830',
                    issueDate: new Date('Sun Jun 15 2014 10:36:30 GMT-0400 (EDT)'),
                    duration: '90',
                    price: 345000,
                    range: '32767',
                    volEntered: 5,
                    volRemaining: 1,
                    minVolume: '1',
                    bid: false },
                  { orderID: '3610396964',
                    typeID: '6158',
                    regionID: '10000048',
                    stationID: '60011824',
                    solarSystemID: '30003830',
                    issueDate: new Date('Sun Jun 08 2014 16:47:10 GMT-0400 (EDT)'),
                    duration: '90',
                    price: 350000,
                    range: '32767',
                    volEntered: 1,
                    volRemaining: 1,
                    minVolume: '1',
                    bid: false },
                  { orderID: '3655076333',
                    typeID: '6158',
                    regionID: '10000048',
                    stationID: '60011893',
                    solarSystemID: '30003794',
                    issueDate: new Date('Tue Jul 08 2014 02:19:10 GMT-0400 (EDT)'),
                    duration: '30',
                    price: 100000,
                    range: '-1',
                    volEntered: 20,
                    volRemaining: 15,
                    minVolume: '1',
                    bid: true } ];

            var fin = fs.createReadStream(fixture_fn);

            MarketDataRaws.updateFromCSV(fin).then(function (updates) {
                expect(updates.length).to.equal(1);
                var result = updates[0].rows();
                expect(result).deep.equal(expected);
                return done();
            });
        });

        it('should update regional orders from EMUU data',
            ensureUpdate(emdr_orders));

        it('should update regional history from EMUU data',
            ensureUpdate(emdr_history));

        function ensureUpdate (emuu) {
            return function (done) {
                var rowset = emuu.rowsets[0];
                var result_type = emuu.resultType;
                var type_id = rowset.typeID;
                var region_id = rowset.regionID;

                MarketDataRaws.query(function (qb) {
                    qb.where('resultType', '=', result_type);
                }).fetch().then(function (objs) {
                    
                    // Check the collection as a whole
                    expect(objs.length).to.equal(1);
                    var obj = objs.at(0);
                    expect(obj.get('resultType')).to.equal(result_type);
                    expect(obj.get('regionID')).to.equal(region_id);
                    expect(obj.get('typeID')).to.equal(type_id);

                    // Try fetching just one expected object
                    MarketDataRaws.model.forge({
                        resultType: result_type,
                        regionID: region_id,
                        typeID: type_id
                    }).fetch().then(function (model) {
                        expect(model.get('resultType')).to.equal(result_type);
                        expect(model.get('regionID')).to.equal(region_id);
                        expect(model.get('typeID')).to.equal(type_id);
                        return done();
                    });

                });
            };
        }

        // TODO
        it('should not accept an update with a generatedAt older than existing data', function (done) {
            expect(false).to.be.true;
            return done();
        });

        describe('MarketDataRaw', function () {

            it('should correctly flatten order rows into objects',
                ensureRows(emdr_orders));

            it('should correctly flatten history rows into objects',
                ensureRows(emdr_history));

            function ensureRows (emuu) {
                return function (done) {
                    var result_type = emuu.resultType;
                    MarketDataRaws.query(function (qb) {
                        qb.where('resultType', '=', result_type);
                    }).fetch().then(function (objs) {
                        var result_rows = objs.first().rows();
                        var expected_rows = emuu.rowsets[0].rows;
                        var col_idx = 3;
                        var key = emuu.columns[col_idx];
                        var val = expected_rows[0][col_idx];
                        expect(result_rows.length).to.equal(expected_rows.length);
                        expect(result_rows[0][key]).to.equal(val);
                        return done();
                    });
                }
            };

            it('should clean attributes of flattened order rows', function (done) {
                MarketDataRaws.query(function (qb) {
                    qb.where('resultType', '=', 'orders');
                }).fetch().then(function (objs) {
                    var result = objs.first().rows()[0];
                    expect(result.issueDate).to.be.an.instanceOf(Date);
                    expect(_.isBoolean(result.bid)).to.be.true;
                    return done();
                });
            });

            it('should clean attributes of flattened history rows', function (done) {
                MarketDataRaws.query(function (qb) {
                    qb.where('resultType', '=', 'history');
                }).fetch().then(function (objs) {
                    var result = objs.first().rows()[0];
                    expect(_.isDate(result.date)).to.be.true;
                    return done();
                });
            });
        
        });

    });

    describe("MarketMargins", function () {

        var MarketMargins, MarketDataRaws;

        beforeEach(function (done) {
            conf.db_Main('MarketMargins').truncate().then(function () {
                MarketMargins = models.MarketMargins.forge();
                MarketDataRaws = models.MarketDataRaws.forge();
                return MarketDataRaws.updateFromEMDR(emdr_orders);
            }).finally(done);
        });

        it('should update margins from raw market data', function (done) {
            var expected = {
                "60011566": {
                    "maxBuyPrice": 51297.06,
                    "minSellPrice": 146666,
                    "baseMargin": 95368.94,
                    "baseMarginPercent": 65.02457283896746
                },
                "60011866": {
                    "maxBuyPrice": 89864.52,
                    "minSellPrice": 139941.92,
                    "baseMargin": 50077.40000000001,
                    "baseMarginPercent":35.784416849504424
                },
                "60011872": {
                    "maxBuyPrice": 85000,
                    "minSellPrice": 434998,
                    "baseMargin": 349998,
                    "baseMarginPercent": 80.45968027439207
                }
            };

            var rowset = emdr_orders.rowsets[0];
            var type_id = rowset.typeID;
            var region_id = rowset.regionID;

            MarketMargins.updateFromMarketData(type_id, region_id)
            .then(function (saved) {
                return MarketMargins.query(function (qb) {
                    qb.where({typeID: type_id, regionID: region_id});
                }).fetch();
            })
            .then(function (objs) {
                var by_station = objs.groupBy('stationID');
                expect(by_station).to.have.keys(_.keys(expected));
                _.each(by_station, function (orders, station_id) {
                    expect(orders.length).to.equal(1);
                    var result = orders[0];
                    _.each(expected[station_id], function (val, key) {
                        expect(result.get(key)).to.equal(val);
                    });
                });
                return done();
            });
        });
    });

    describe('MarketHistoryAggregates', function () {

        var MarketHistoryAggregates, MarketDataRaws;

        beforeEach(function (done) {
            conf.db_Main('MarketHistoryAggregates').truncate().then(function () {
                MarketHistoryAggregates = models.MarketHistoryAggregates.forge();
                MarketDataRaws = models.MarketDataRaws.forge();
                return MarketDataRaws.updateFromEMDR(emdr_history);
            }).finally(done);
        });

        it('should update market aggregates from raw market data', function (done) {
            var expected = {
                avgDailyVolume: 23.35929648241206,
                avgDailyVolumeForMonth: 19,
                avgDailyVolumeForWeek: 31.571428571428573,
                volatility: 38.56297146782043,
                volatilityForMonth: 29.370102015168747,
                volatilityForWeek: 30.186398809636888
            };

            var rowset = emdr_history.rowsets[0];
            var type_id = rowset.typeID;
            var region_id = rowset.regionID;

            MarketHistoryAggregates.updateFromMarketData(type_id, region_id)
            .then(function (saved) {
                return MarketHistoryAggregates.query(function (qb) {
                    qb.where({typeID: type_id, regionID: region_id});
                }).fetch();
            })
            .then(function (objs) {
                expect(objs.length).to.equal(1);
                var result = objs.first();
                _.each(expected, function (val, key) {
                    expect(result.get(key)).to.equal(val);
                });
            });

            return done();
        });

    });

    describe('MarketTradeLeads', function () {
        var MarketTradeLeads, MarketDataRaws, MarketMargins;

        before(function (done) {
            MarketTradeLeads = models.MarketTradeLeads.forge();
            MarketDataRaws = models.MarketDataRaws.forge();
            MarketMargins = models.MarketMargins.forge();
            return done();
        });

        describe('artificial data', function () {
            var emdr_orders_hubs = require(fixtures_path + 'emdr-orders-hubs.json');

            beforeEach(function (done) {
                Promise.all([
                    conf.db_Main('MarketTradeLeads').truncate(),
                    conf.db_Main('MarketMargins').truncate(),
                    conf.db_Main('MarketDataRaw').truncate()
                ]).then(function () {
                    return MarketDataRaws.updateFromEMDR(emdr_orders_hubs);
                }).then(function (updates) {
                    // Generate the market margins
                    return Promise.all(updates.map(function (update) {
                        return MarketMargins.updateFromMarketData(
                            update.get('typeID'),
                            update.get('regionID')
                        );
                    }));
                }).then(function () {
                    // Use a queue to scan for trade leads from the rowsets
                    // Forcing serial scans prevents duplicates vs Promise.all()
                    var queue = async.queue(function (task, next) {
                        MarketTradeLeads
                            .updateFromMarketData(task.typeID, task.regionID)
                            .then(function (results) { next(); });
                    }, 1);
                    queue.push(emdr_orders_hubs.rowsets);
                    queue.drain = done;
                }); 
            });

            it('should find the expected number of total leads', function (done) {
                conf.db_Main('MarketTradeLeads').count('id').then(function (ct) {
                    expect(ct[0]['count("id")']).to.equal(40);
                    return done();
                });
            });

            it('should yield the expected leads updated in a single scan', function (done) {
                var expected = 
                    { '60003760:true:60004588:true': { baseMargin: 1500, baseMarginPercent: 75 },
                      '60003760:true:60004588:false': { baseMargin: 2500, baseMarginPercent: 83.33 },
                      '60003760:false:60004588:true': { baseMargin: 1000, baseMarginPercent: 50 },
                      '60003760:false:60004588:false': { baseMargin: 2000, baseMarginPercent: 66.67 },
                      '60003760:true:60011866:true': { baseMargin: 1100, baseMarginPercent: 68.75 },
                      '60003760:true:60011866:false': { baseMargin: 1300, baseMarginPercent: 72.22 },
                      '60003760:false:60011866:true': { baseMargin: 600, baseMarginPercent: 37.5 },
                      '60003760:false:60011866:false': { baseMargin: 800, baseMarginPercent: 44.44 },
                      '60005686:true:60003760:true': { baseMargin: 200, baseMarginPercent: 40 },
                      '60003760:true:60005686:false': { baseMargin: 100, baseMarginPercent: 16.67 },
                      '60005686:true:60003760:false': { baseMargin: 700, baseMarginPercent: 70 },
                      '60005686:false:60003760:false': { baseMargin: 400, baseMarginPercent: 40 },
                      '60003760:true:60008494:true': { baseMargin: 300, baseMarginPercent: 37.5 },
                      '60003760:true:60008494:false': { baseMargin: 1000, baseMarginPercent: 66.67 },
                      '60008494:true:60003760:false': { baseMargin: 200, baseMarginPercent: 20 },
                      '60003760:false:60008494:false': { baseMargin: 500, baseMarginPercent: 33.33 } }

                var rowset = emdr_orders_hubs.rowsets[0];
                MarketTradeLeads
                    .updateFromMarketData(rowset.typeID, rowset.regionID)
                    .then(function (leads) {
                        // Reduce the set of leads down to something easy to verify
                        var result = _.chain(leads).map(function (lead_model) {
                            var lead = lead_model.toJSON();
                            return [
                                _.chain(lead)
                                    .pick(['fromStationID', 'fromBid', 'toStationID', 'toBid'])
                                    .values().join(':').value(),
                                _.pick(lead, ['baseMargin', 'baseMarginPercent'])
                            ];
                        }).object().value();
                        expect(result).deep.equal(expected);
                        return done();
                    });
            });

            it('should find expected leads for sell/buy query', function (done) {
                var expected_leads =
                    { Jita: 
                       { Rens: 
                          [ { toSolarSystemName: 'Rens',
                              baseMargin: 1000,
                              baseMarginPercent: 50 } ],
                         Dodixie: 
                          [ { toSolarSystemName: 'Dodixie',
                              baseMargin: 600,
                              baseMarginPercent: 37.5 } ] },
                      Dodixie: 
                       { Rens: 
                          [ { toSolarSystemName: 'Rens',
                              baseMargin: 200,
                              baseMarginPercent: 10 } ] },
                      Hek: 
                       { Rens: 
                          [ { toSolarSystemName: 'Rens',
                              baseMargin: 1400,
                              baseMarginPercent: 70 } ],
                         Dodixie: 
                          [ { toSolarSystemName: 'Dodixie',
                              baseMargin: 1000,
                              baseMarginPercent: 62.5 } ],
                         Amarr: 
                          [ { toSolarSystemName: 'Amarr',
                              baseMargin: 200,
                              baseMarginPercent: 25 } ] },
                      Amarr: 
                       { Rens: 
                          [ { toSolarSystemName: 'Rens',
                              baseMargin: 500,
                              baseMarginPercent: 25 } ],
                         Dodixie: 
                          [ { toSolarSystemName: 'Dodixie',
                              baseMargin: 100,
                              baseMarginPercent: 6.25 } ] } };

                MarketTradeLeads.query(function (qb) {
                    // Buy from sell orders at origin, sell to buy orders at destination
                    qb.where({fromBid: false, toBid: true})
                }).fetch().then(function (leads) {
                    // This should also exercise the static IDs in trade leads...
                    return leads.joinFromStatic();
                }).then(function (lead_models) {

                    // Collate leads into a two-level object indexed by from and to
                    var lead_models_json = lead_models.toJSON();
                    var leads = _.chain(lead_models_json)
                        .groupBy('fromSolarSystemName')
                        .map(function (leads, from_system) {
                            leads = _.map(leads, function (lead) {
                                return _.pick(lead, [
                                    'toSolarSystemName', 'baseMargin', 'baseMarginPercent'
                                ]);
                            });
                            return [
                                from_system,
                                _.groupBy(leads, 'toSolarSystemName')
                            ];
                        }).object().value();
                    
                    _.each(leads, function (to_system_leads, from_system) {
                        // Neither of these systems are default hubs...
                        expect(from_system).to.not.equal('Barleguet');
                        expect(from_system).to.not.equal('Sendaya');

                        _.each(to_system_leads, function (leads, to_system) {
                            // Neither of these systems are default hubs...
                            expect(to_system).to.not.equal('Barleguet');
                            expect(to_system).to.not.equal('Sendaya');

                            // This lead should be expected.
                            var expected = expected_leads[from_system][to_system][0];
                            expect(expected).to.exist;

                            // There should be no duplicate trade leads.
                            expect(leads.length).to.equal(1);
                            var result = leads[0];
                            
                            // Ensure the lead has expected values.
                            _.each(expected, function (val, key) {
                                expect(result[key]).to.equal(val);
                            });
                        })
                    });

                    return done();
                });
            });
        });

        describe('natural data', function () {

            beforeEach(function (done) {
                Promise.all([
                    conf.db_Main('MarketTradeLeads').truncate(),
                    conf.db_Main('MarketMargins').truncate(),
                    conf.db_Main('MarketDataRaw').truncate()
                ]).then(function () {
                    return done();
                });
            });

            function ensureLeads(from_fn, to_fn, expected) {
                return function (done) {
                    var from_fin = fs.createReadStream(fixtures_path + from_fn);
                    var to_fin = fs.createReadStream(fixtures_path + to_fn);

                    var from_raw, to_raw;

                    Promise.all([
                        MarketDataRaws.updateFromCSV(from_fin),
                        MarketDataRaws.updateFromCSV(to_fin)
                    ]).spread(function (from_updates, to_updates) {
                        from_raw = from_updates[0];
                        to_raw = to_updates[0];
                        return Promise.all([
                            MarketMargins.updateFromMarketData(
                                from_raw.get('typeID'), from_raw.get('regionID')),
                            MarketMargins.updateFromMarketData(
                                to_raw.get('typeID'), to_raw.get('regionID'))
                        ]);
                    }).spread(function (from_margins, to_margins) {
                        return MarketTradeLeads.updateFromMarketData(
                            from_raw.get('typeID'), from_raw.get('regionID'));
                    }).then(function (leads) {
                        var results = _.map(leads, function (lead) {
                            return _.pick(lead.toJSON(), [
                                'fromBid', 'fromPrice', 'toBid', 'toPrice',
                                'iskPerM3', 'baseMargin', 'baseMarginPercent'
                            ]);
                        });
                        expect(results).to.deep.equal(expected);
                        return done();
                    });
                };
            }

            it('should discover the matching orders for Photonic Metamaterials', ensureLeads(
                'The Forge-Photonic Metamaterials-2014.07.16 024246.txt',
                'Sinq Laison-Photonic Metamaterials-2014.07.16 022702.txt',
                [ { fromBid: true, fromPrice: 11420.01,
                    toBid: true, toPrice: 12534.08,
                    iskPerM3: 985.49,
                    baseMargin: 1114.07, baseMarginPercent: 8.89 },
                  { fromBid: true, fromPrice: 11420.01,
                    toBid: false, toPrice: 15995.38,
                    iskPerM3: 4575.37,
                    baseMargin: 4575.37, baseMarginPercent: 28.6 },
                  { fromBid: false, fromPrice: 11756.82,
                    toBid: true, toPrice: 12534.08,
                    iskPerM3: 648.68,
                    baseMargin: 777.26, baseMarginPercent: 6.2 },
                  { fromBid: false, fromPrice: 11756.82,
                    toBid: false, toPrice: 15995.38,
                    iskPerM3: 3517.21,
                    baseMargin: 4238.56, baseMarginPercent: 26.5 } ]
            ));

            it('should discover the matching orders for Zydrine', ensureLeads(
                'The Forge-Zydrine-2014.07.16 024303.txt',
                'Sinq Laison-Zydrine-2014.07.16 023130.txt',
                [ { fromBid: true, fromPrice: 586.1,
                    toBid: true, toPrice: 611.12,
                    iskPerM3: 1917.57,
                    baseMargin: 25.02, baseMarginPercent: 4.09 },
                  { fromBid: true, fromPrice: 586.1,
                    toBid: false, toPrice: 619.95,
                    iskPerM3: 3385,
                    baseMargin: 33.85, baseMarginPercent: 5.46 },
                  { fromBid: false, fromPrice: 595.99,
                    toBid: true, toPrice: 611.12,
                    iskPerM3: 1449.05,
                    baseMargin: 15.13, baseMarginPercent: 2.48 },
                  { fromBid: false, fromPrice: 595.99,
                    toBid: false, toPrice: 619.95,
                    iskPerM3: 1662.49,
                    baseMargin: 23.96, baseMarginPercent: 3.86 } ]
            ));

        });
    });

});
