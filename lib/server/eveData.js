import eveData from '../eveData';

export default function (options, shared, app) {

  [ 'mapRegions', 'mapConstellations', 'mapSolarSystems', 'invTypes',
    'invMetaGroups', 'invMetaLevels', 'invMarketGroups', 'invCategories'
  ].forEach(name => {
    app.get('/eveData/' + name, (req, res) => {
      eveData[name](req.query)
        .then(results => res.send(results))
        .catch(e => res.status(500).send(''+e))
    });
  });

  app.get('/eveData/invMarketGroupIDs', (req, res) => {
    eveData.invMarketGroupIDs(req.query.root)
      .then(results => res.send(results))
      .catch(e => res.status(500).send(''+e))
  });

}
