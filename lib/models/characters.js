import fs from 'fs';
import path from 'path';
import csv from 'csv';
import _ from 'lodash';
import Promise from 'bluebird';
import config from '../../config';

import requestOrig from 'request';
const request = Promise.promisify(requestOrig);

const LOGIN_URL = 'https://login.eveonline.com/';
const CREST_BASE_URL = 'https://crest-tq.eveonline.com';  // TODO: config?

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

function annotateOrdersWithLocations(orders) {
  const stationIDs = _.chain(orders).map('stationID').uniq();
  return Promise.props(stationIDs.map(stationID => [
    stationID,
    request({
      method: 'GET',
      json: true,
      url: CREST_BASE_URL + '/universe/locations/' + stationID + '/'
    })
  ]).fromPairs().value()).then(locations => {
    _.forEach(orders, v => v.location = locations[v.stationID].body);
    return orders;
  });
}

export default function (BaseModel, BaseCollection, Models) {

  const Character = BaseModel.extend({
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
      return this.belongsToMany(Models.ApiKey, 'ApiKeys_Characters',
        'Characters_id', 'ApiKeys_id');
    },

    transactions: function () {
      return this.hasMany(Models.WalletTransaction, 'characterID');
    },

    journals: function () {
      return this.hasMany(Models.WalletJournal, 'characterID');
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
        id => Models.WalletTransaction.forge({transactionID: id})
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
        id => Models.WalletJournal.forge({refID: id})
          .createOrUpdate(Object.assign(
            result.transactions[id],
            {characterID: this.id}
          )),
        {concurrency: 1}
      ));
    },

    updateOrders: function (key) {
      let orders;
      return key.getClient().fetch('char:MarketOrders', {
        characterID: this.get('characterID')
      }).then(result => annotateOrdersWithLocations(result.orders))
      .then(orders => {
        this.set('orders', orders);
        return orders;
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

  const Characters = BaseCollection.extend({
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
        return annotateOrdersWithLocations(orders)
          .then(orders => character.set('orders', orders).save());
      }));
    });
  };

  return {Character, Characters};
}
