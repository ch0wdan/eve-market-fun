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
    .use('/bower_components', express.static(path.join(__dirname, '../bower_components')))
    .use(express.static(path.join(__dirname, '../public')))
    .use(express.json())
    .use(express.urlencoded())
    .use(express.cookieParser())
    .use(express.methodOverride())
    .use(express.bodyParser())
    .use(express.cookieSession({ secret: conf.get('secret') }))
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
    .use(app.router)
    ;

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

nunjucks.configure('views', {
    autoescape: true,
    express: app
});

passport.serializeUser(function(user, done) {
    done(null, user.get('uuid'));
});

passport.deserializeUser(function(uuid, done) {
    models.User.forge({uuid: uuid})
        .fetch({require: true})
        .then(function (user) {
            try { done(null, user.toJSON()); }
            catch (e) { done(e); }
        })
        .catch(done);
});

var LocalStrategy = require('passport-local').Strategy;
passport.use('local-signup', new LocalStrategy({
    usernameField : 'email',
    passwordField : 'password',
    passReqToCallback : true
}, function(req, email, password, done) {
    models.User.forge({ email: email })
        .fetch({ require: true })
        .then(function (user) {
            return done(null, false,
                req.flash('signupMessage', 'That email is already taken.'));
        })
        .catch(function (err) {
            var newUser = new models.User({ email: email });
            newUser.hashPassword(password);
            newUser.save()
                .then(function() {
                    util.debug("NEW USER SAVED " + email);
                    done(null, newUser)
                })
                .catch(function (err) {
                    done(err, null)
                });
        })
}));
passport.use('local-login', new LocalStrategy({
    usernameField : 'email',
    passwordField : 'password',
    passReqToCallback : true
},
function(req, email, password, done) {
    models.User.forge({ email: email }).fetch()
        .catch(function (err) { return done(err) })
        .then(function (user) {
            if (!user) {
                return done(null, false,
                    req.flash('loginMessage', 'No user found.'));
            }
            if (!user.validPassword(password)) {
                return done(null, false,
                    req.flash('loginMessage', 'Oops! Wrong password.'));
            }
            return done(null, user);
        })
}));

function isLoggedIn(req, res, next) {
	if (req.isAuthenticated()) { return next(); }
	res.redirect('/');
}

function commonTemplateLocals(req, data) {
    var out = _.defaults(data, {
        request: req,
        user: req.user
    });
    return out;
}

app.get('/', function(req, res) {
    var username = 'lmorchard';
    var character_name = 'Pham Vrinimi';

    var out = {
        title: "EVE Market Fun",
        orders: {
            sell: [],
            buy: []
        }
    };

    res.render('index.html', commonTemplateLocals(req, out));
});

app.get('/auth/login', function (req, res) {
    res.render('auth/login.html', commonTemplateLocals(req, {
        message: req.flash('loginMessage')
    }));
});

app.post('/auth/login', passport.authenticate('local-login', {
    successRedirect : '/auth/profile',
    failureRedirect : '/auth/login',
    failureFlash : true
}));

app.get('/auth/signup', function (req, res) {
    var form = appForms.signup();
    res.render('auth/signup.html', commonTemplateLocals(req, {
        form: form,
        message: req.flash('signupMessage')
    }));
});

app.post('/auth/signup', function (req, res) {
    var form = appForms.signup();
    form.handle(req, {
        error: function (form) {
            util.debug("ERRRRR " + form.isValid());
            Object.keys(form.fields).every(function (k) {
                util.debug("ERR " + k + " " + form.fields[k].error);
            });
            res.render('auth/signup.html', commonTemplateLocals(req, {
                form: form,
                message: req.flash('signupMessage')
            }));
        },
        empty: function (form) {
            res.redirect('/auth/signup');
        },
        success: function (form) {
            res.send("HI " + util.inspect(form.data));
        }
    });
});

/*
app.post('/auth/signup', passport.authenticate('local-signup', {
    successRedirect : '/auth/profile',
    failureRedirect : '/auth/signup',
    failureFlash : true
}));
*/

app.get('/auth/profile', function (req, res) {
    util.debug("AUTH PROFILE " + util.inspect(req.user));
    res.render('auth/profile.html', commonTemplateLocals(req, {
        user: req.user,
        deb: util.inspect(req.user)
    }));
});

app.get('/auth/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

app.get('/market/items', function (req, res) {
    var out = { };
    res.render('market/items.html', commonTemplateLocals(req, out));
});

app.get('/market/orders', function (req, res) {
    var out = { };
    res.render('market/orders.html', commonTemplateLocals(req, out));
});

app.get('/data/orders.json', function (req, res) {
    var orders_type = (req.param('type') == 'buy') ? 'buy' : 'sell';

    var username = 'lmorchard';
    var character_name = 'Pham Vrinimi';

    var out = {
        orders: {
            sell: [],
            buy: []
        }
    };

    var user, character;

    models.User.forge({username: username}).fetch({require: true})
    .then(function (user) {
        //out.user = user.toJSON();
        return user.characters()
            .query({where: {name: character_name}})
            .fetchOne({withRelated: ['apiKey'], require: true});
    }).then(function (character) {
        //out.character = character.toJSON();
        return character.marketOrders()
            .query({where: {orderState: 0}})
            .fetch();
    }).then(function (orders) {
        return orders.joinFromStatic();
    }).then(function (orders) {
        out.orders = orders.chain().map(function (order) {
            order = order.toJSON();
            _.each(['price', 'volEntered', 'volRemaining'], function (name) {
                order[name] = parseFloat(order[name]);
            });
            order.bidType = (['1', 'True'].indexOf(order.bid) !== -1) ?
                'buy': 'sell';
            return order;
        }).sortBy('typeName').value();
        /*.groupBy('bidType').*/
    }).catch(function (e) {
        util.debug(e);
    }).finally(function () {
        //res.send(out.orders[orders_type]);
        res.send(out.orders);
    });
});

app.get('/data/invMarketGroups', function (req, res) {
    eveData.invMarketGroups(req.query.root, ('shallow' in req.query))
        .then(function (results) { res.send(results) })
        .catch(function (e) { res.status(500).send(''+e); })
});

app.get('/data/invMarketGroupIDs', function (req, res) {
    eveData.invMarketGroupIDs(req.query.root)
        .then(function (results) { res.send(results) })
        .catch(function (e) { res.status(500).send(''+e); })
});

app.get('/data/invTypes', function (req, res) {
    eveData.invTypes(req.query)
        .then(function (rows) { res.send(rows) })
        .catch(function (e) { res.status(500).send(''+e); })
});

app.get('/data/invMetaGroups', function (req, res) {
    eveData.invMetaGroups(req.query)
        .then(function (rows) { res.send(rows) })
        .catch(function (e) { res.status(500).send(''+e); })
});

app.get('/data/invMetaLevels', function (req, res) {
    eveData.invMetaLevels(req.query)
        .then(function (rows) { res.send(rows) })
        .catch(function (e) { res.status(500).send(''+e); })
});

module.exports = function () {
    http.createServer(app).listen(app.get('port'), function(){
      logger.info('Express server listening on port ' + app.get('port'));
    });
};
