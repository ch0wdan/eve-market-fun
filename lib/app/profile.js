var util = require('util');
var logger = require('winston');
var Promise = require('bluebird');

var conf = require('../config');
var models = require('../models');
var eveData = require('../eveData');
var appForms = require('../forms');

module.exports = function (app) {

    app.get('/u/:username', function (req, res) {
        res.render('profile/index.html', {
        });
    });

    app.get('/u/:username/settings', function (req, res) {
        var out = {};
        req.user.apiKeys().fetch()
        .then(function (keys) {
            out.apikeys = (!keys.length) ? null :
                keys.map(function (k) { return k.toJSON() });
        })
        .finally(function () {
            res.render('profile/settings.html', out);
        });
    });

    app.get('/u/:username/settings/apikey', function (req, res) {
        var form = appForms.apikey();
        var out = {
            form: form
        };
        res.render('profile/apikey.html', out);
    });

    app.post('/u/:username/settings/apikey', function (req, res) {
        var form = appForms.apikey();
        var out = {
            form: form
        };
        form.handle(req, {
            error: function (form) {
                res.render('profile/apikey.html', { form: form });
            },
            empty: function (form) {
                res.redirect(req.path);
            },
            success: function (form) {
                models.ApiKey.forge({ keyID: form.data.keyID }) 
                .fetch({ require: true })
                .then(function (apikey) {
                    req.flash('message', 'API key already registered');
                    res.render('profile/apikey.html', { form: form });
                })
                .catch(function (err) {
                    var new_key = new models.ApiKey({
                        keyID: form.data.keyID,
                        vCode: form.data.vCode,
                        userUuid: req.user.get('uuid')
                    });
                    return Promise.all([
                        new_key,
                        new_key.client().fetch('account:APIKeyInfo')
                    ]);
                })
                .spread(function (new_key, api_result) {
                    util.debug("RESULT " + util.inspect(api_result));
                    if (!api_result.key) {
                        throw "Key verification failed " + util.inspect(api_result);
                    } else {
                        new_key.set({
                            accessMask: api_result.key.accessMask,
                            expires: api_result.key.expires
                        });
                        return new_key.save();
                    }
                })
                .then(function (key) {
                    res.redirect('/u/' + req.user.username + '/settings');
                })
                .catch(function (err) {
                    req.flash('message', 'Problem adding API key - ' + err);
                    res.render('profile/apikey.html', { form: form });
                })
            }
        });

    });

    app.get('/u/:username/settings/apikey/:keyid/delete', function (req, res) {
        var out = {};
        req.user.apiKeys()
        .query({where: {keyID: req.params.keyid}})
        .fetchOne({require: true})
        .catch(function (err) {
            res.redirect('/u/' + req.user.get('username') + '/settings');
        })
        .then(function (key) {
            out.apikey = key.toJSON();
            res.render('profile/apikey_delete.html', out);
        });
    });

    app.post('/u/:username/settings/apikey/:keyid/delete', function (req, res) {
        req.user.apiKeys()
        .query({where: {keyID: req.params.keyid}})
        .fetchOne({require: true})
        .catch(function (err) {
            res.redirect('/u/' + req.user.get('username') + '/settings');
        })
        .then(function (key) {
            return key.destroy();
        })
        .then(function () {
            req.flash('message', 'API key deleted');
            res.redirect('/u/' + req.user.get('username') + '/settings');
        });
    });

};
