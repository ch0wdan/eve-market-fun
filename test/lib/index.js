var util = require('util');

var _ = require('underscore');
var logger = require('winston');
var Promise = require('bluebird');
var requestReal = require('request');
var request = Promise.promisify(requestReal);

var conf = require(__dirname + '/../../lib/config');
var models = require(__dirname + '/../../lib/models');

exports.migrateDB = function () {
    return conf.db_Main.migrate.latest({
        directory: __dirname + '/../../migrations',
        database: conf.db_Main
    });
}

exports.USERS = _.map([
    ['traderjoe', 'traderjoe@example.com', 'traderjoe'],
    ['traderjane', 'traderjane@example.com', 'traderjane'],
    ['traderjill', 'traderjill@example.com', 'traderjill'],
    ['traderalice', 'traderalice@example.com', 'traderalice'],
    ['traderbob', 'traderbob@example.com', 'traderbob']
], function (row) {
    return _.object(['username', 'email', 'password'], row);
});

exports.setupUsers = function () {
    return Promise.all(exports.USERS.map(function (data) {
        var uniq = _.pick(data, ['username', 'email']);
        var user = models.User.forge(uniq);
        return user.fetch().then(function (found) {
            return found ? found :
                user.hashPassword(data.password).save();
        });
    }));
}

exports.loginUsers = function (BASE_URL) {
    var jars = {};
    exports.USERS.forEach(function (user) {
        jars[user.username] = request({
            method: 'POST',
            url: BASE_URL + '/auth/login',
            form: {
                username: user.username,
                password: user.password
            }
        }).spread(function (resp, body) {
            var cookie_jar = requestReal.jar();
            var auth_session = resp.headers['set-cookie'][0];
            var auth_cookie = requestReal.cookie(auth_session);
            cookie_jar.setCookie(auth_cookie, BASE_URL);
            return cookie_jar;
        });
    });
    return Promise.props(jars);
}
