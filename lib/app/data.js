var eveData = require('../eveData');

module.exports = function (app) {

    var auto_routes = [
        'mapRegions', 'mapConstellations', 'mapSolarSystems',
        'invTypes', 'invMetaGroups', 'invMetaLevels',
        'invMarketGroups', 'invCategories'
    ];
    auto_routes.forEach(function (name) {
        app.get('/data/' + name, function (req, res) {
            eveData[name](req.query)
                .then(function (results) { res.send(results) })
                .catch(function (e) { res.status(500).send(''+e); })
        });
    });

    app.get('/data/invMarketGroupIDs', function (req, res) {
        eveData.invMarketGroupIDs(req.query.root)
            .then(function (results) { res.send(results) })
            .catch(function (e) { res.status(500).send(''+e); })
    });

}
