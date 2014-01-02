var eveData = require('../eveData');

module.exports = function (app) {

    app.get('/data/invMarketGroups', function (req, res) {
        eveData.invMarketGroups(req.query.root, ('shallow' in req.query))
            .then(function (results) { res.send(results) })
            .catch(function (e) { res.status(500).send(''+e); })
    });

    app.get('/data/invMarketGroupIDs', function (req, res) {
        eveData.invMarketGroupIDs(req.query.root)
            .then(function (results) { res.send(results) })
            .catch(function (e) { res.status(500).send(''+e); })
    });

    app.get('/data/invTypes', function (req, res) {
        eveData.invTypes(req.query)
            .then(function (rows) { res.send(rows) })
            .catch(function (e) { res.status(500).send(''+e); })
    });

    app.get('/data/invMetaGroups', function (req, res) {
        eveData.invMetaGroups(req.query)
            .then(function (rows) { res.send(rows) })
            .catch(function (e) { res.status(500).send(''+e); })
    });

    app.get('/data/invMetaLevels', function (req, res) {
        eveData.invMetaLevels(req.query)
            .then(function (rows) { res.send(rows) })
            .catch(function (e) { res.status(500).send(''+e); })
    });

}
