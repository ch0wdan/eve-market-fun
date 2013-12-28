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

    app.get('/data/orders.json', function (req, res) {
        var orders_type = (req.param('type') == 'buy') ? 'buy' : 'sell';

        var username = 'lmorchard';
        var character_name = 'Pham Vrinimi';

        var out = {
            orders: {
                sell: [],
                buy: []
            }
        };

        var user, character;

        models.User.forge({username: username}).fetch({require: true})
        .then(function (user) {
            //out.user = user.toJSON();
            return user.characters()
                .query({where: {name: character_name}})
                .fetchOne({withRelated: ['apiKey'], require: true});
        }).then(function (character) {
            //out.character = character.toJSON();
            return character.marketOrders()
                .query({where: {orderState: 0}})
                .fetch();
        }).then(function (orders) {
            return orders.joinFromStatic();
        }).then(function (orders) {
            out.orders = orders.chain().map(function (order) {
                order = order.toJSON();
                _.each(['price', 'volEntered', 'volRemaining'], function (name) {
                    order[name] = parseFloat(order[name]);
                });
                order.bidType = (['1', 'True'].indexOf(order.bid) !== -1) ?
                    'buy': 'sell';
                return order;
            }).sortBy('typeName').value();
            /*.groupBy('bidType').*/
        }).catch(function (e) {
            util.debug(e);
        }).finally(function () {
            //res.send(out.orders[orders_type]);
            res.send(out.orders);
        });
    });

}
