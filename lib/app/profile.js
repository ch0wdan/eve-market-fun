var util = require('util');
var _ = require('underscore');
var logger = require('winston');
var Promise = require('bluebird');

var conf = require('../config');
var models = require('../models');
var eveData = require('../eveData');
var appForms = require('../forms');

module.exports = function (app) {

    // TODO: Access control based on login & username

    app.get('/u/:username', function (req, res) {
        res.render('profile/index.html', {
        });
    });

    app.get('/u/:username/settings', app.loginRequired, function (req, res) {
        var out = {};
        req.user.apiKeys().fetch({
            withRelated: ['characters']
        }).then(function (keys) {
            out.apikeys = keys.toJSON();
        }).finally(function () {
            res.render('profile/settings.html', out);
        });
    });

    app.get('/u/:username/settings/apikey', app.loginRequired, function (req, res) {
        res.render('profile/apikey.html', {
            form: appForms.apikey()
        });
    });

    app.post('/u/:username/settings/apikey', app.loginRequired, function (req, res) {
        var form = appForms.apikey();
        form.handleAsync(req).catch(function (form) {
            res.render('profile/apikey.html', { form: form });
        }).then(function (form) {
            return Promise.all([
                form,
                models.ApiKey.forge({
                    keyID: form.data.keyID
                }).fetch()
            ]);
        }).spread(function (form, key) {
            if (key) {
                throw 'API key already registered';
            }
            var new_key = models.ApiKey.forge({
                userID: req.user.get('id'),
                keyID: form.data.keyID,
                vCode: form.data.vCode
            });
            return Promise.all([
                new_key,
                new_key.client().fetch('account:APIKeyInfo')
            ]);
        }).spread(function (key, key_info) {
            if (!key_info || !key_info.key) {
                throw 'API key invalid';
            }
            key.set({
                accessMask: key_info.key.accessMask,
                expires: key_info.key.expires
            });
            return Promise.all([
                key.save(),
                key.client().fetch('account:Characters')
            ]);
        }).spread(function (key, result) {
            if (!result || !result.characters) {
                throw 'No characters for API key';
            }
            return Promise.all(_.map(result.characters,
                function (character, id) {
                    return models.Character.forge({
                        characterID: character.characterID,
                        userID: req.user.id,
                        keyID: key.id
                    }).createOrUpdate(_.pick(character, [
                        'name', 'corporationName', 'corporationID'
                    ]));
                }));
        }).then(function (characters) {
            var ct = characters.length;
            req.flash('message', {
                level: 'success',
                message: 'Imported API key and ' + ct + ' characters'
            });
            res.redirect('/u/' + req.user.get('username') + '/settings');
        }).catch(function (err) {
            res.render('profile/apikey.html', {
                message: [err],
                form: form
            });
        })
    });

    app.get('/u/:username/settings/apikey/:keyid/delete', app.loginRequired, function (req, res) {
        var out = {};
        req.user.apiKeys().query({
            where: { keyID: req.params.keyid }
        }).fetchOne({
            require: true,
            withRelated: ['characters']
        }).catch(function (err) {
            res.redirect('/u/' + req.user.get('username') + '/settings');
        }).then(function (key) {
            out.key = key.toJSON();
        }).finally(function () {
            res.render('profile/apikey_delete.html', out);
        });
    });

    app.post('/u/:username/settings/apikey/:keyid/delete', app.loginRequired, function (req, res) {
        req.user.apiKeys().query({
            where: { keyID: req.params.keyid }
        }).fetchOne({require: true}).catch(function (err) {
            res.redirect('/u/' + req.user.get('username') + '/settings');
        }).then(function (key) {
            return key.destroy();
        }).then(function () {
            req.flash('message', 'API key and associated characters deleted');
            res.redirect('/u/' + req.user.get('username') + '/settings');
        });
    });

    app.get('/data/profile', app.loginRequired, function (req, res) {
        var out = req.user.toJSON();
        req.user.apiKeys().fetch({
            withRelated: ['characters']
        }).then(function (keys) {
            out.apiKeys = keys.toJSON();
            res.send(out);
        });
    });

    app.get('/data/profile/locationfavorites', app.loginRequired, function (req, res) {
        var out = {};
        req.user.locationFavorites().fetch().then(function (faves) {
            return faves.joinFromStatic();
        }).then(function (faves) {
            out = faves.toJSON();
            res.send(out);
        }).catch(function (e) {
            res.status(500).send(''+e);
        });
    });

    app.put('/data/profile/locationfavorites', app.loginRequired, function (req, res) {
        models.LocationFavorite.forge({
            userID: req.user ? req.user.get('id') : req.body.userID,
            regionID: req.body.regionID,
            constellationID: req.body.constellationID,
            solarSystemID: req.body.solarSystemID
        }).createOrUpdate().then(function (fave) {
            res.send(200, fave.toJSON());
        }).catch(function (e) {
            res.status(500).send(''+e);
        })
    });

    app.delete('/data/profile/locationfavorites/:id', app.loginRequired, function (req, res) {
        req.user.locationFavorites().query({
            where: { id: req.params.id }
        }).fetchOne({require: true}).catch(function (e) {
            res.status(404);
        }).then(function (fave) {
            return fave.destroy();
        }).then(function () {
            res.send("1");
        }).catch(function (e) {
            res.status(500).send(''+e);
        })
    });

};
