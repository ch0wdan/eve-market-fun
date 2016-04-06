import path from 'path';
import http from 'http';
import express from 'express';
import nunjucks from 'nunjucks';
import Promise from 'bluebird';
import requireDir from 'require-dir';
import _ from 'lodash';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpack from 'webpack';
import passport from 'passport';

export default function (options, shared) {
  const logger = shared.logger;

  const loggerStream = {
    write: (message, encoding) => logger.info('HTTP ' + message.trim())
  };

  const app = express();

  app
    .set('port', shared.config.port)
    .set('views', path.join(__dirname, '../../views'))
    .use(require('morgan')('dev', { stream: loggerStream }))
    .use(require('method-override')('_method'))
    .use(require('express-json')())
    .use(require('body-parser').urlencoded({ extended: true }))
    .use(require('cookie-parser')())
    .use(require('cookie-session')({ secret: shared.config.secret }))
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
    Object.assign(res.locals, {
      request: req,
      user: req.user ? req.user : null,
      message: req.flash('message'),
      eve: req.eve,
      eve_json: JSON.stringify(req.eve)
    });
    next();
  });

  nunjucks.configure('views', { autoescape: true, express: app });

  app.route('/').get((req, res) => {
    res.render('index.html');
  });

  const modules = requireDir();
  for (const name in modules) {
    modules[name].default(options, shared, app);
  }

  if (options.debug === true || process.env.NODE_ENV === 'development') {
    app.use(require('errorhandler')())
    app.use(webpackDevMiddleware(
      webpack(require('../../webpack.config')),
      {
        log: msg => logger.debug(msg),
        stats: { colors: true },
        publicPath: '/'
      }
    ));
  }

  const publicPath = path.join(__dirname, '../../public');
  app.use(require('serve-static')(publicPath));

  const port = (options || {}).port || app.get('port');
  return new Promise(function (fulfill, reject) {
    const server = http.createServer(app).listen(port, function () {
      server.port = port;
      fulfill(server);
    });
  });
}
