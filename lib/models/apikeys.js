import _ from 'lodash';
import Neow from 'neow';
import Promise from 'bluebird';

import config from '../../config';

import NeowDiskCache from 'neow/lib/caching/disk';
const neowCache = new NeowDiskCache.DiskCache(config.neowCachePath || 'cache');
const neowApiUrl = 'https://api.eveonline.com';

export default function (BaseModel, BaseCollection, Models) {

  const ApiKey = BaseModel.extend({
    tableName: 'ApiKeys',

    characters: function () {
      return this.belongsToMany(Models.Character, 'ApiKeys_Characters',
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
            return Models.Character.forge({characterID}).createOrUpdate(data);
          }));
        })
        // Attach the characters we just updated.
        .then(updatedCharacters => this.characters().attach(updatedCharacters))
        // Finally, just resolve with a self-reference.
        .then(() => this);
    }
  });

  const ApiKeys = BaseCollection.extend({
    model: ApiKey
  });

  return {ApiKey, ApiKeys};
}
