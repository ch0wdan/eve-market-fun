/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var path = require('path');

var conf = require('./config');
var routes = require('./routes');
var user = require('./routes/user');

var logger = require('winston');

module.exports = function () {
    var app = express();

    // all environments
    app.set('port', conf.get('port'));
    app.set('views', path.join(__dirname, '../views'));
    app.set('view engine', 'ejs');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.session({
        secret: '8675309jenny2'
    }));

    app.use(app.router);
    app.use(require('stylus').middleware(path.join(__dirname, '../public')));
    app.use(express.static(path.join(__dirname, '../public')));

    // development only
    if ('development' == app.get('env')) {
      app.use(express.errorHandler());
    }

    app.get('/', routes.index);
    app.get('/orders.json', routes.orders_json);
    app.get('/hello', routes.hello);
    app.get('/users', user.list);

    http.createServer(app).listen(app.get('port'), function(){
      logger.info('Express server listening on port ' + app.get('port'));
    });
};
