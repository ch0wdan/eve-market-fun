import _ from 'lodash';
import Knex from 'knex';
import Neow from 'neow';
import Promise from 'bluebird';

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
var MAX_AGE = 10 * 60 * 1000;

export const TRADE_HUBS = _.chain([
  ['Jita',    30000142, 10000002, 60003760],
  ['Rens',    30002510, 10000030, 60004588],
  ['Hek',     30002053, 10000042, 60005686],
  ['Amarr',   30002187, 10000043, 60008494],
  ['Dodixie', 30002659, 10000032, 60011866]
]).map(row => _.zipObject([
  'solarSystemName', 'solarSystemID', 'regionID', 'stationID'
], row)).keyBy('regionID').value();

export const BaseModel = Bookshelf.Model.extend({
  hasTimestamps: true,
  defaults: function () {
    return {};
  },
  fieldAliases: {},
  jsonAttributes: [],
  createOrUpdate: function (props) {
    var orig = this;
    return this.fetch().then(function (model) {
      return (model || orig).save(props);
    });
  },
  cleanAttrs: function (attrs) {
    attrs = this.aliasFields(attrs);
    attrs = this.stringifyJSONAttributes(attrs);
    return attrs;
  },
  aliasFields: function (attrs) {
    const out = {};
    for (let key in attrs) {
      out[this.fieldAliases[key] || key] = attrs[key];
    }
    return out;
  },
  stringifyJSONAttributes: function (attrs) {
    for (let i = 0; i < this.jsonAttributes.length; i++) {
      const name = this.jsonAttributes[i];
      if (name in attrs) {
        const val = attrs[name];
        attrs[name] = (val === null) ? null : JSON.stringify(val);
      }
    }
    return attrs;
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
  }
});

export const BaseCollection = Bookshelf.Collection.extend({
});

export const Character = BaseModel.extend({
  tableName: 'Characters',

  jsonAttributes: ['orders'],

  fieldAliases: {
    'CharacterID': 'characterID',
    'CharacterName': 'characterName'
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
      orders: this.updateOrders(key)
    });
  },

  updateTransactions: function (key) {
    return key.getClient().fetch('char:WalletTransactions', {
      characterID: this.get('CharacterID'),
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
      characterID: this.get('CharacterID'),
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
      characterID: this.get('CharacterID')
    }).then(result =>
      this.save({orders: result.orders}, {patch: true})
        .then(saved => result.orders)
    );
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
        return this.save({
          accessMask: apiResult.key.accessMask,
          type: apiResult.key.type,
          expires: apiResult.key.expires
        });
      })
      // Next, detach any characters associated with this key.
      .then(result => this.characters().fetch())
      .then(oldCharacters => this.characters().detach(oldCharacters.toArray()))
      // Then, update the characters included in the API result.
      .then(result => {
        const characterIDs = Object.keys(apiResult.key.characters);
        return Promise.all(characterIDs.map(CharacterID => {
          const data = _.pick(apiResult.key.characters[CharacterID], [
            'characterID', 'characterName',
            'corporationID', 'corporationName',
            'allianceID', 'allianceName',
            'factionID', 'factionName'
          ]);
          return Character.forge({CharacterID}).createOrUpdate(data);
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
  jsonAttributes: ['history', 'buyOrders', 'sellOrders'],

  fetchCRESTData: function (character, options) {
    const accessToken = character.get('accessToken');

    // Skip fetching data, if we already have data and last update recent.
    /*
    const now = Date.now();
    if (this.get('history') !== null &&
        this.get('sellOrders') !== null &&
        this.get('buyOrders') !== null &&
        (now - this.get('updated_at')) < MAX_AGE) {
      return this;
    }
    */

    const ordersBase = 'https://crest-tq.eveonline.com/market/' +
      this.get('regionID') + '/orders/';
    const typeUrl = 'https://public-crest.eveonline.com/types/' +
      this.get('typeID') + '/';
    const historyUrl = 'https://public-crest.eveonline.com/market/' +
      this.get('regionID') + '/types/' + this.get('typeID') + '/history/';

    return Promise.props({
      sell: request({
        method: 'GET', url: ordersBase + 'sell/?type=' + typeUrl,
        json: true, auth: { bearer: accessToken }
      }),
      buy: request({
        method: 'GET', url: ordersBase + 'buy/?type=' + typeUrl,
        json: true, auth: { bearer: accessToken }
      }),
      history: request({
        method: 'GET', url: historyUrl, json: true
      })
    }).then(results => this.save({
      history: results.history.body.items,
      sellOrders: results.sell.body.items,
      buyOrders: results.buy.body.items
    })).catch(err => {
      console.error("ERR", this.get('typeID'), this.get('regionID'), err);
    });
  },

  calculateSummaries: function () {
    let history = this.get('history');
    let buyOrders = this.get('buyOrders');
    let sellOrders = this.get('sellOrders');
    let buy = this.get('buy');
    let sell = this.get('sell');
    let spread = 0;
    let margin = 0;

    history = _.sortByOrder(history, ['date'], [false]);

    if (buyOrders.length > 0) {
      buy = _.chain(buyOrders)
        .sort((a, b) => b.price - a.price)
        .first().value().price;
    }

    if (sellOrders.length > 0) {
      sell = _.chain(sellOrders)
        .sort((a, b) => a.price - b.price)
        .first().value().price;
    }

    // TODO: calculate buy / sell of top 5% orders

    if (buy && sell) {
      spread = sell - buy;
      margin = (spread / buy) * 100.0;
    }

    /*
    this.avgDailyVolume = this.avgVolume();
    this.avgDailyVolumeForWeek = this.avgVolume(7);
    this.avgDailyVolumeForMonth = this.avgVolume(30);

    this.volatility = this.calcVolatility();
    this.volatilityForMonth = this.calcVolatility(7);
    this.volatilityForWeek = this.calcVolatility(30);
    */

    return this.save({buy, sell, spread, margin}, {patch: true});
    // return this.lookupMarketGroupPath().then(() => this);
  },

  lookupMarketGroupPath: function () {
    if (this.marketGroupIDPath) {
      return Promise.resolve(true);
    }
    return eveData.invMarketGroupPath(this.marketGroupID).then(function (path) {
      this.marketGroupIDPath = path;
      return this;
    });
  }
});

export const MarketTypes = BaseCollection.extend({
  model: MarketType
});
