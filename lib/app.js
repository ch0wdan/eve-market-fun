/**
 * Module dependencies.
 */
var util = require('util');
var http = require('http');
var path = require('path');
var fs = require('fs');

var express = require('express');
var nunjucks = require('nunjucks');
var logger = require('winston');
var _ = require('underscore');

var conf = require('./config');

var Bookshelf = require('bookshelf');
Bookshelf.db_Main = Bookshelf.initialize(conf.get('database'));
var models = require('./models');
var eveData = require('./eveData');

var passport = require('passport');

var app = express();

app.set('port', conf.get('port'))
    .set('views', path.join(__dirname, '../views'));

app.use(express.favicon())
    .use(express.logger('dev'))
    .use('/bower_components',
        express.static(path.join(__dirname, '../bower_components')))
    .use(express.static(path.join(__dirname, '../public')))
    .use(express.methodOverride())
    .use(express.json())
    .use(express.urlencoded())
    .use(express.cookieParser())
    .use(express.cookieSession({ secret: conf.get('secret') }))
    .use(require('connect-flash')())
    .use(passport.initialize())
    .use(passport.session());

// Grab EVE headers
app.use(function (req, res, next) {
    req.eve = {};
    _.each(req.headers, function (val, name) {
        if (name.indexOf('eve_') !== 0) { return; }
        var prop = name.substr(4);
        if ('trusted' == prop) {
            val = ('Yes' == val);
        }
        req.eve[prop] = val;
    });
    next();
});

// Common template locals
app.use(function (req, res, next) {
    var locals = {
        request: req,
        user: req.user ? req.user.toJSON() : null,
        message: req.flash('message'),
        eve: req.eve,
        eve_json: JSON.stringify(req.eve)
    };
    res.locals(locals);
    next();
});

app.use(app.router);

app.configure('development', function () {
    app.use(express.errorHandler());
});

nunjucks.configure('views', {
    autoescape: true,
    express: app
});

app.get('/', function(req, res) {
    var out = {};
    models.neowClient()
    .fetch('server:ServerStatus')
    .then(function (result) {
        out.server_status = result;
    })
    .finally(function () {
        res.render('index.html', out);
    });
});

require('./app/auth')(app);
require('./app/profile')(app);
require('./app/data')(app);
require('./app/market')(app);

module.exports = function (options) {
    options = options || {};
    var port = options.port || app.get('port');
    return http.createServer(app).listen(port, function(){
        logger.info('Express server listening on port ' + port);
    });
};
module.exports.app = app;
