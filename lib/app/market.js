
module.exports = function (app) {

    app.get('/market/items', function (req, res) {
        var out = { };
        res.render('market/items.html', out);
    });

    app.get('/market/orders', function (req, res) {
        var out = { };
        res.render('market/orders.html', out);
    });

};
