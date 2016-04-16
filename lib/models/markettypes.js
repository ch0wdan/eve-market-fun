import _ from 'lodash';
import Promise from 'bluebird';
import fs from 'fs';
import path from 'path';
import csv from 'csv';

import requestOrig from 'request';
const request = Promise.promisify(requestOrig);

import eveData from '../eveData';

const DEFAULT_MAX_AGE = 30 * 60 * 1000;
const DEFAULT_TIMEOUT = 7000;

export default function (BaseModel, BaseCollection, Models) {

  const MarketType = BaseModel.extend({
    tableName: 'MarketTypes',

    jsonAttributes: ['history', 'buyOrders', 'sellOrders', 'marketGroupIDPath'],

    update: function (character, options) {
      return this.fetchCRESTData(character, options)
        .then(result => this.calculateSummaries());
    },

    fetchCRESTData: function (character, options) {
      const {timeout, max_age} = _.defaults(options || {}, {
        timeout: DEFAULT_TIMEOUT,
        max_age: DEFAULT_MAX_AGE
      });

      const accessToken = character.get('accessToken');

      // Skip fetching data, if we already have it from a recent update.
      const now = Date.now();
      if (this.get('history') !== null &&
          this.get('sellOrders') !== null &&
          this.get('buyOrders') !== null &&
          (now - this.get('updated_at').getTime()) < (max_age * 1000)) {
        return Promise.resolve(this);
      }

      const typeUrl = 'https://public-crest.eveonline.com/types/' +
        this.get('typeID') + '/';
      const ordersBase = 'https://crest-tq.eveonline.com/market/' +
        this.get('regionID') + '/orders/';
      const historyUrl = 'https://crest-tq.eveonline.com/market/' +
        this.get('regionID') + '/types/' + this.get('typeID') + '/history/';

      return Promise.props({
        sell: request({
          method: 'GET', url: ordersBase + 'sell/?type=' + typeUrl,
          timeout, json: true, auth: { bearer: accessToken }
        }),
        buy: request({
          method: 'GET', url: ordersBase + 'buy/?type=' + typeUrl,
          timeout, json: true, auth: { bearer: accessToken }
        }),
        history: request({
          method: 'GET', url: historyUrl,
          timeout, json: true, auth: { bearer: accessToken }
        })
      }).then(results => {
        return this.set({
          history: results.history.body.items,
          sellOrders: results.sell.body.items,
          buyOrders: results.buy.body.items
        }).save();
      });
    },

    calculateSummaries: function () {
      let history = this.get('history');
      let buyOrders = this.get('buyOrders');
      let sellOrders = this.get('sellOrders');
      let buy = this.get('buy');
      let sell = this.get('sell');
      let buyPrices = {};
      let sellPrices = {};
      let spread = 0;
      let margin = 0;

      if (buyOrders && buyOrders.length > 0) {
        buyOrders.sort((a, b) => b.price - a.price);
        buy = buyOrders[0].price;
        buyPrices = _.chain(buyOrders)
          .groupBy(o => o.location.id)
          .map((orders, location_id) => [location_id, orders[0].price])
          .fromPairs().value();
      }

      if (sellOrders && sellOrders.length > 0) {
        sellOrders.sort((a, b) => a.price - b.price);
        sell = sellOrders[0].price;
        sellPrices = _.chain(sellOrders)
          .groupBy(o => o.location.id)
          .map((orders, location_id) => [location_id, orders[0].price])
          .fromPairs().value();
      }

      // TODO: calculate buy / sell of top 5% orders

      if (buy && sell) {
        spread = sell - buy;
        margin = (spread / buy) * 100.0;
      }

      return this.lookupMarketGroupPath().then(() => this.set({
        buy, sell, buyPrices, sellPrices, spread, margin
      }).save());
    },

    lookupMarketGroupPath: function () {
      var val = this.get('marketGroupIDPath');
      return (!!val) ? Promise.resolve(val) :
        eveData.invMarketGroupPath(this.get('marketGroupID')).then(path => {
          this.set('marketGroupIDPath', path);
          return path;
        });
    }
  });

  const MarketTypes = BaseCollection.extend({
    model: MarketType
  });

  MarketTypes.parseExportCSV = function (filepath) {
    let rows = [];
    return new Promise((resolve, reject) => {
      // Parse the CSV at the filepath into rows
      const parser = csv.parse({columns: true},
        (err, data) => { rows = rows.concat(data); });
      fs.createReadStream(filepath).pipe(parser)
        .on('end', () => resolve(rows))
        .on('error', err => reject(err));
    }).then(rows => {
      const rowsByType = _.groupBy(rows, row => row.typeID + ':' + row.regionID);
      return Promise.all(_.map(rowsByType, (rows, key) => {
        const [typeID, regionID] = key.split(':');
        const orders = _.map(rows, row => ({
          id: row.orderID,
          buy: row.bid === 'True',
          issued: row.issueDate,
          price: row.price,
          volumeEntered: row.volEntered,
          minVolume: row.minVolume,
          volume: row.volRemaining,
          range: row.range, // FIXME: Not properly mapped
          duration: row.duration,
          href: 'https://crest-tq.eveonline.com/market/' + row.regionID +
              '/orders/' + row.orderID + '/',
          location: {
            id: row.stationID,
            href: 'https://crest-tq.eveonline.com/universe/locations/' +
                row.stationID + '/'
          },
          type: {
             id: row.typeID,
             href: 'https://crest-tq.eveonline.com/types/' + row.typeID + '/',
          }
        }));
        const buyOrders = _.filter(orders, order => order.buy);
        const sellOrders = _.filter(orders, order => !order.buy);
        return MarketType
          .forge({typeID, regionID})
          .createOrUpdate({buyOrders, sellOrders})
          .then(type => type.calculateSummaries())
          .then(type => type.save());
      }));
    });
  };

  return {MarketType, MarketTypes};
}
