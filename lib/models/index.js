import _ from 'lodash';
import Knex from 'knex';
import Neow from 'neow';
import Promise from 'bluebird';

import fs from 'fs';
import path from 'path';
import csv from 'csv';

import eveData from '../eveData';
import config from '../../config';

import requestOrig from 'request';
const request = Promise.promisify(requestOrig);

export const db = Knex(config.mainDB);
export const Bookshelf = require('bookshelf')(db);

import NeowDiskCache from 'neow/lib/caching/disk';
const neowCache = new NeowDiskCache.DiskCache(config.neowCachePath || 'cache');
const neowApiUrl = 'https://api.eveonline.com';

const LOGIN_URL = 'https://login.eveonline.com/';
const DEFAULT_MAX_AGE = 30 * 60 * 1000;
const DEFAULT_TIMEOUT = 7000;

export const TRADE_HUBS = _.chain([
  ['Jita',    30000142, 10000002, 60003760],
  ['Rens',    30002510, 10000030, 60004588],
  ['Hek',     30002053, 10000042, 60005686],
  ['Amarr',   30002187, 10000043, 60008494],
  ['Dodixie', 30002659, 10000032, 60011866]
]).map(row => _.zipObject([
  'solarSystemName', 'solarSystemID', 'regionID', 'stationID'
], row)).keyBy('regionID').value();

function flattenContent (data) {
  var out = {};
  for (let key in data) {
    let val = data[key];
    if (_.isObject(val)) {
      if (Object.keys(val).length == 0) {
        val = null;
      } else if ('content' in val) {
        val = val.content;
      } else {
        val = flattenContent(val);
      }
    }
    out[key] = val;
  }
  return out;
}

export const BaseModel = Bookshelf.Model.extend({
  hasTimestamps: true,
  fieldAliases: {},
  jsonAttributes: [],
  ignoredAttributes: [],

  defaults: function () { return {}; },

  createOrUpdate: function (props) {
    var orig = this;
    return this.fetch().then(function (model) {
      return props ?
        (model || orig).save(props) :
        (model || orig);
    });
  },

  cleanAttrs: function (attrs) {
    const out = {};
    for (let key in attrs) {
      if (this.ignoredAttributes.indexOf(key) !== -1) {
        continue;
      }
      let val = attrs[key];
      if (val === '') { val = null; }
      if (this.jsonAttributes.indexOf(key) !== -1) {
        val = (val === null) ? null : JSON.stringify(val);
      }
      out[this.fieldAliases[key] || key] = val;
    }
    return out;
  },

  get: function (attr) {
    const val = this.attributes[attr];
    return this.jsonAttributes.indexOf(attr) !== -1 ?
      JSON.parse(val || null) : val;
  },

  set: function (key, val, options) {
     if (key == null) return this;
    var attrs;
    if (typeof key === 'object') {
      attrs = key;
      options = val;
    } else {
      (attrs = {})[key] = val;
    }
    options || (options = {});
    attrs = this.cleanAttrs(attrs);
    return Bookshelf.Model.prototype.set.call(this, attrs, options);
  },

  serialize: function (options) {
    const obj = Bookshelf.Model.prototype.serialize.call(this, options);
    this.jsonAttributes.forEach(name => {
      const val = obj[name];
      obj[name] = JSON.parse(val || null);
    });
    return obj;
  }
});

export const BaseCollection = Bookshelf.Collection.extend({
});

export const Character = BaseModel.extend({
  tableName: 'Characters',

  jsonAttributes: ['orders'],

  ignoredAttributes: ['currentTime', 'cachedUntil'],

  fieldAliases: {
    'CharacterID': 'characterID',
    'CharacterName': 'characterName',
    'name': 'characterName',
    'corporation': 'corporationName',
    'balance': 'accountBalance',
    'alliance': 'allianceName',
    'bloodline': 'bloodLine',
    'bloodlineID': 'bloodLineID'
  },

  apiKeys: function () {
    return this.belongsToMany(ApiKey, 'ApiKeys_Characters',
      'Characters_id', 'ApiKeys_id');
  },

  transactions: function () {
    return this.hasMany(WalletTransaction, 'characterID');
  },

  journals: function () {
    return this.hasMany(WalletJournal, 'characterID');
  },

  update: function (key) {
    return Promise.props({
      transactions: this.updateTransactions(key),
      journal: this.updateJournal(key),
      orders: this.updateOrders(key),
      sheet: this.updateCharacterSheet(key),
      info: this.updateCharacterInfo(key)
    }).then(result => this.save().then(() => result));
  },

  updateCharacterInfo: function (key) {
    return key.getClient().fetch('eve:CharacterInfo', {
      characterID: this.get('characterID')
    }).then(result => this.set(flattenContent(result)));
  },

  updateCharacterSheet: function (key) {
    return key.getClient().fetch('char:CharacterSheet', {
      characterID: this.get('characterID')
    }).then(result => this.set(flattenContent(result)));
  },

  updateTransactions: function (key) {
    return key.getClient().fetch('char:WalletTransactions', {
      characterID: this.get('characterID'),
      rowCount: 1000
    }).then(result => Promise.map(
      Object.keys(result.transactions),
      id => WalletTransaction.forge({transactionID: id})
        .createOrUpdate(Object.assign(
          result.transactions[id],
          {characterID: this.id}
        )),
      {concurrency: 1}
    ));
  },

  updateJournal: function (key) {
    return key.getClient().fetch('char:WalletJournal', {
      characterID: this.get('characterID'),
      rowCount: 1000
    }).then(result => Promise.map(
      Object.keys(result.transactions),
      id => WalletJournal.forge({refID: id})
        .createOrUpdate(Object.assign(
          result.transactions[id],
          {characterID: this.id}
        )),
      {concurrency: 1}
    ));
  },

  updateOrders: function (key) {
    return key.getClient().fetch('char:MarketOrders', {
      characterID: this.get('characterID')
    }).then(result => {
      this.set('orders', result.orders);
      return result.orders;
    });
  },

  authorizeCrest: function () {
    return request({
      method: 'POST',
      url: LOGIN_URL + 'oauth/token/',
      json: true,
      auth: {
        user: config.sso.clientID,
        pass: config.sso.clientSecret
      },
      body: {
        grant_type: 'refresh_token',
        refresh_token: this.get('refreshToken')
      }
    }).then(result => this.save(
      {accessToken: result.body.access_token},
      {patch: true}
    ).then(saved => result.body));
  },

  whoamiCrest: function () {
    return request({
      method: 'GET',
      url: LOGIN_URL + 'oauth/verify',
      json: true,
      auth: { bearer: this.get('accessToken') },
    }).then(result => result.body);
  }

});

export const Characters = BaseCollection.extend({
  model: Character
});

Characters.parseExportCSV = function (filepath) {
  let rows = [];
  return new Promise((resolve, reject) => {
    // Parse the CSV at the filepath into rows
    const parser = csv.parse({columns: true},
      (err, data) => { rows = rows.concat(data); });
    fs.createReadStream(filepath).pipe(parser)
      .on('end', () => resolve(rows))
      .on('error', err => reject(err));
  }).then(rows => {
    // Look up all the characters with IDs appearing in the CSV rows - most
    // likely just one character, but let's be sure.
    return Promise.props(
      _.chain(rows).map('charID').uniq().map(characterID => [
        characterID,
        Character.forge({characterID: characterID}).fetch()
      ]).fromPairs().value()
    );
  }).then(characters => {
    // Separate out the CSV rows by character ID and update each character
    const rowsByCharacter = _.groupBy(rows, 'charID');
    return Promise.all(_.map(characters, character => {
      // Map the rows to the format we get from the char:MarketOrders XML API
      const charID = character.get('characterID');
      const orders = _.chain(rowsByCharacter[charID]).map(row => [
        row.orderID, {
          orderID: row.orderID,
          charID: charID,
          stationID: row.stationID,
          regionID: row.regionID,
          volEntered: row.volEntered,
          volRemaining: row.volRemaining,
          minVolume: row.minVolume,
          orderState: row.orderState,
          typeID: row.typeID,
          range: row.range,
          accountKey: '1000',
          duration: row.duration,
          escrow: row.escrow,
          price: row.price,
          bid: row.bid === 'True' ? '1' : '0',
          issued: row.issueDate
        }
      ]).fromPairs().value();
      return character.set('orders', orders).save();
    }));
  });
};

export const ApiKey = BaseModel.extend({
  tableName: 'ApiKeys',

  characters: function () {
    return this.belongsToMany(Character, 'ApiKeys_Characters',
      'ApiKeys_id', 'Characters_id');
  },

  getClient: function () {
    return new Neow.EveClient({
      keyID: this.get('keyID'),
      vCode: this.get('vCode')
    }, neowApiUrl, neowCache);
  },

  update: function () {
    let apiResult;
    return this.getClient().fetch('account:APIKeyInfo')
      // First, update the API key.
      .then(result => {
        apiResult = result;
        const data = {
          accessMask: apiResult.key.accessMask,
          type: apiResult.key.type,
          expires: apiResult.key.expires
        };
        return this.save(data);
      })
      // Next, detach any characters associated with this key.
      .then(result => this.characters().fetch())
      .then(oldCharacters => this.characters().detach(oldCharacters.toArray()))
      // Then, update the characters included in the API result.
      .then(result => {
        const characterIDs = Object.keys(apiResult.key.characters);
        return Promise.all(characterIDs.map(characterID => {
          const data = _.pick(apiResult.key.characters[characterID], [
            'characterID', 'characterName',
            'corporationID', 'corporationName',
            'allianceID', 'allianceName',
            'factionID', 'factionName'
          ]);
          return Character.forge({characterID}).createOrUpdate(data);
        }));
      })
      // Attach the characters we just updated.
      .then(updatedCharacters => this.characters().attach(updatedCharacters))
      // Finally, just resolve with a self-reference.
      .then(() => this);
  }
});

export const ApiKeys = BaseCollection.extend({
  model: ApiKey
});

export const WalletTransaction = BaseModel.extend({
  tableName: 'WalletTransactions'
});

export const WalletTransactions = BaseCollection.extend({
  model: WalletTransaction
});

export const WalletJournal = BaseModel.extend({
  tableName: 'WalletJournal'
});

export const WalletJournals = BaseCollection.extend({
  model: WalletJournal
});

export const MarketType = BaseModel.extend({
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

export const MarketTypes = BaseCollection.extend({
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
