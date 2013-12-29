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

var conf = require('./config');

var Bookshelf = require('bookshelf');
Bookshelf.db_Main = Bookshelf.initialize(conf.get('database'));
var models = require('./models');
var eveData = require('./eveData');

var passport = require('passport');

var app = express();

app.set('port', conf.get('port'))
    .set('views', path.join(__dirname, '../views'))

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

// Common template locals
app.use(function (req, res, next) {
    res.locals({
        request: req,
        user: req.user ? req.user.toJSON() : null,
        message: req.flash('message')
    });
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
    res.render('index.html', {});
});

require('./app/auth')(app);
require('./app/profile')(app);
require('./app/data')(app);
require('./app/market')(app);

module.exports = function () {
    http.createServer(app).listen(app.get('port'), function(){
      logger.info('Express server listening on port ' + app.get('port'));
    });
};
