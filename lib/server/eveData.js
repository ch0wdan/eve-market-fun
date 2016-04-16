import express from 'express';
import eveData from '../eveData';

export default function (options, shared, app) {
  const router = express.Router();

  const endpoints = [
    'mapRegions', 'mapConstellations', 'mapSolarSystems', 'invTypes',
    'invMetaGroups', 'invMetaLevels', 'invMarketGroups', 'invCategories'
  ];
  endpoints.forEach(name => {
    router.get('/' + name, (req, res) => {
      eveData[name](req.query)
        .then(results => res.send(results))
        .catch(e => res.status(500).send(''+e))
    });
  });

  router.get('/invMarketGroupIDs', (req, res) => {
    eveData.invMarketGroupIDs(req.query.root)
      .then(results => res.send(results))
      .catch(e => res.status(500).send(''+e))
  });

  app.use('/eveData', router);
}
