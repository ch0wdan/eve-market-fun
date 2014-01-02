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

    app.get('/u/:username/settings', function (req, res) {
        var out = {};
        req.user.apiKeys().fetch({
            withRelated: ['characters']
        }).then(function (keys) {
            out.apikeys = keys.toJSON();
        }).finally(function () {
            res.render('profile/settings.html', out);
        });
    });

    app.get('/u/:username/settings/apikey', function (req, res) {
        res.render('profile/apikey.html', {
            form: appForms.apikey()
        });
    });

    app.post('/u/:username/settings/apikey', function (req, res) {
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
                userUuid: req.user.get('uuid'),
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
                        userUuid: req.user.id,
                        keyUuid: key.id
                    }).createOrUpdate(_.pick(character, [
                        'name', 'corporationName', 'corporationID'
                    ]));
                }));
        }).then(function (characters) {
            var ct = characters.length;
            req.flash('message',
                'Imported API key and ' + ct + ' characters');
            res.redirect('/u/' + req.user.get('username') + '/settings');
        }).catch(function (err) {
            res.render('profile/apikey.html', {
                message: [err],
                form: form
            });
        })
    });

    app.get('/u/:username/settings/apikey/:keyid/delete', function (req, res) {
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

    app.post('/u/:username/settings/apikey/:keyid/delete', function (req, res) {
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

};
