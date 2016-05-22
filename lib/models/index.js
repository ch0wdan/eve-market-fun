import _ from 'lodash';
import Knex from 'knex';

import config from '../../config';

export const db = Knex(config.mainDB);
export const Bookshelf = require('bookshelf')(db);

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
    const isJSON = this.jsonAttributes.indexOf(attr) !== -1
    let val = this.attributes[attr];
    // HACK: Arrays sometimes end up double-serialized :(
    if (isJSON && val && val.indexOf('"[') === 0) { val = JSON.parse(val); }
    return isJSON ? JSON.parse(val || null) : val;
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
      let val = obj[name];
      if (val && val.indexOf('"[') === 0) { val = JSON.parse(val); }
      obj[name] = JSON.parse(val || null);
    });
    return obj;
  }
});

export const BaseCollection = Bookshelf.Collection.extend({
});

export const {Character, Characters} =
  require('./characters').default(BaseModel, BaseCollection, exports);

export const {MarketType, MarketTypes} =
  require('./markettypes').default(BaseModel, BaseCollection, exports);

export const {ApiKey, ApiKeys} =
  require('./apikeys').default(BaseModel, BaseCollection, exports);

export const {WalletTransaction, WalletTransactions} =
  require('./wallettransactions').default(BaseModel, BaseCollection, exports);

export const {WalletJournal, WalletJournals} =
  require('./walletjournals').default(BaseModel, BaseCollection, exports);
