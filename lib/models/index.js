import Knex from 'knex';
import _ from 'lodash';

import eveData from '../eveData';
import config from '../../config';

export const db = Knex(config.mainDB);
export const Bookshelf = require('bookshelf')(db);

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
  tableName: 'Characters'
});

export const Characters = BaseCollection.extend({
  model: Character
});
