/**
 * Module dependencies.
 */
var util = require('util');
var http = require('http');
var path = require('path');
var fs = require('fs');

var express = require('express');
var _ = require('underscore');
var async = require('async');
var nunjucks = require('nunjucks');
var CSV = require('csv');
var Promise = require('bluebird');
var Knex = require('knex');

var logger = require('winston');

var conf = require('./config');
var Bookshelf = require('bookshelf');
Bookshelf.db_Main = Bookshelf.initialize(conf.get('database'));
var models = require('./models');
var eveData = require('./eveData');

var passport = require('passport');
var flash = require('connect-flash');

var forms = require('forms'),
    fields = forms.fields,
    widgets = forms.widgets,
    validators = forms.validators;
var appForms = require('./forms');

var app = express();

// all environments
app.set('port', conf.get('port'))
    .set('views', path.join(__dirname, '../views'))

app.use(express.favicon())
    .use(express.logger('dev'))
    .use('/bower_components',
        express.static(path.join(__dirname, '../bower_components')))
    .use(express.static(path.join(__dirname, '../public')))
    .use(express.json())
    .use(express.urlencoded())
    .use(express.cookieParser())
    .use(express.methodOverride())
    .use(express.bodyParser())
    .use(express.cookieSession({
        secret: conf.get('secret')
    }))
    /*
    .use(express.session({
        secret: conf.get('secret')
        store: {
            set: function (sid, sess, fn) {
                fn(err);
            },
            get: function (sid, fn) {
                fn(err, result);
            },
            destroy: function (sid, fn) {
                fn(err);
            }
        }
    }))
    */
    .use(flash())
    .use(passport.initialize())
    .use(passport.session())
    ;

// Common template locals
app.use(function (req, res, next) {
    res.locals({
        request: req,
        user: req.user
    });
    next();
});

app.use(app.router);

if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

nunjucks.configure('views', {
    autoescape: true,
    express: app
});

app.get('/', function(req, res) {
    res.render('index.html', {});
});

require('./app/auth')(app);
require('./app/data')(app);
require('./app/market')(app);

module.exports = function () {
    http.createServer(app).listen(app.get('port'), function(){
      logger.info('Express server listening on port ' + app.get('port'));
    });
};
