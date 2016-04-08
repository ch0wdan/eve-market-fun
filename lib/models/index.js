import _ from 'lodash';
import Knex from 'knex';
import Neow from 'neow';
import Promise from 'bluebird';

import eveData from '../eveData';
import config from '../../config';

export const db = Knex(config.mainDB);
export const Bookshelf = require('bookshelf')(db);

import NeowDiskCache from 'neow/lib/caching/disk';
const neowCache = new NeowDiskCache.DiskCache(config.neowCachePath || 'cache');
const neowApiUrl = 'https://api.eveonline.com';

export const BaseModel = Bookshelf.Model.extend({

  hasTimestamps: true,

  defaults: function () {
    return {};
  },

  createOrUpdate: function (props) {
    var orig = this;
    return this.fetch().then(function (model) {
      return (model || orig).save(props);
    });
  }

});

export const BaseCollection = Bookshelf.Collection.extend({
});

export const Character = BaseModel.extend({
  tableName: 'Characters',

  apiKeys: function () {
    return this.belongsToMany(ApiKey, 'ApiKeys_Characters',
      'Characters_id', 'ApiKeys_id');
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
