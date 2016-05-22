import _ from 'lodash';
import express from 'express';
import Promise from 'bluebird';

import eveData from '../eveData';
import {db, Character,
        WalletTransaction, WalletTransactions,
        WalletJournal, WalletJournals,
        MarketType, MarketTypes} from '../models';

function authRequired (req, res, next) {
  const fail = () =>
    res.status(403).send({error: 'Authentication required'});
  if (req.headers.authorization) {
    const [type, enc] = req.headers.authorization.split(' ');
    const [user, passwd] = Buffer(enc, 'base64').toString('utf8').split(':');
    Character.forge({
      characterID: user
    }).fetch().then(character => {
      req.user = character;
      return (req.user) ? next() : fail();
    });
  } else {
    return (req.user) ? next() : fail();
  }
}

export default function (options, shared, app) {
  const router = express.Router();

  router.get('/market/types/:typeID', (req, res, next) => {
    Promise.props({
      type: eveData.invTypes({typeID: req.params.typeID}),
      regions: db('MarketTypes')
        .select('regionID')
        .distinct('regionID')
        .where('typeID', '=', req.params.typeID)
    }).then(result => {
      const regionIDs = _.map(result.regions, 'regionID');
      res.send(Object.assign(result.type[0], {regions: regionIDs}));
    });
  });

  router.get('/market/types/:typeID/:regionID', (req, res, next) => {
    Promise.props({
      type: eveData.invTypes({typeID: req.params.typeID}),
      marketType: MarketType
        .forge({typeID: req.params.typeID,
                regionID: req.params.regionID})
        .createOrUpdate({})
        .then(type => type.update(req.user))
    }).then(result => {
      res.send(Object.assign(
        result.marketType.toJSON(),
        result.type[0]
      ));
    }).catch(err => {
      res.status(404).send();
    });
  });

  router.get('/market/regions/:regionID', (req, res, next) => {
    MarketTypes.query(qb => {
      qb.where({regionID: req.params.regionID});
    }).fetch().then(result => {
      res.send(result.toJSON());
    });
  });

  router.get('/orders/:characterPK', (req, res, next) => {
    Character.forge({characterID: req.params.characterPK}).fetch().then(character => {
      if (!character) { throw 'no such character ' + req.params.characterPK; }
      const orders = Object.values(character.get('orders'));
      res.send(orders);
    }).catch(err => {
      res.status(404).send(err);
    });
  });

  router.get('/transactions/:characterPK', (req, res, next) => {
    Character.forge({characterID: req.params.characterPK}).fetch().then(character => {
      if (!character) { throw 'no such character ' + req.params.characterPK; }
      return WalletTransactions.query(qb => {
        qb.where({characterID: character.get('id')});
      }).fetch();
    }).then(journals => {
      res.send(journals.toJSON());
    }).catch(err => {
      res.status(404).send(err);
    });
  });

  router.get('/journals/:characterPK', (req, res, next) => {
    Character.forge({characterID: req.params.characterPK}).fetch().then(character => {
      if (!character) { throw 'no such character ' + req.params.characterPK; }
      return WalletJournals.query(qb => {
        qb.where({characterID: character.get('id')});
      }).fetch();
    }).then(journals => {
      res.send(journals.toJSON());
    }).catch(err => {
      res.status(404).send(err);
    });
  });

  app.use('/data', authRequired, router);
}
