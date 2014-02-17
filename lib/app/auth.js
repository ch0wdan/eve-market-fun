var util = require('util');

var Promise = require('bluebird');
var passport = require('passport');
var models = require('../models');
var eveData = require('../eveData');
var appForms = require('../forms');

passport.serializeUser(function(user, done) {
    done(null, user.get('id'));
});

passport.deserializeUser(function(id, done) {
    models.User.forge({id: id}).fetch()
    .then(function (user) {
        try { done(null, user); }
        catch (e) { done(e); }
    })
    .catch(done);
});

var LocalStrategy = require('passport-local').Strategy;
passport.use('local-login', new LocalStrategy({
    usernameField : 'username',
    passwordField : 'password',
    passReqToCallback : true
},
function(req, username, password, done) {
    models.User.forge({ username: username }).fetch()
        .catch(function (err) { return done(err) })
        .then(function (user) {
            if (!user || !user.validPassword(password)) {
                req.flash('message', {
                    level: 'error',
                    message: 'Incorrect username or password'
                });
                return done(null, false);
            }
            return done(null, user);
        })
}));

module.exports = function (app) {

    app.get('/auth/home', function (req, res) {
        if (req.isAuthenticated()) {
            res.redirect('/u/' + req.user.username);
        } else {
            res.redirect('/auth/login');
        }
    });

    app.get('/auth/login', function (req, res) {
        res.render('auth/login.html', {
        });
    });

    app.post('/auth/login', passport.authenticate('local-login', {
        successRedirect : '/auth/home',
        failureRedirect : '/auth/login',
        failureFlash : true
    }));

    app.get('/auth/signup', function (req, res) {
        var form = appForms.signup();
        res.render('auth/signup.html', {
            form: form,
            message: req.flash('signupMessage')
        });
    });

    app.post('/auth/signup', function (req, res) {
        var form = appForms.signup();
        form.handleAsync(req).catch(function (form) {
            res.render('auth/signup.html', {
                form: form
            });
        }).then(function (form) {
            return Promise.all([
                form,
                models.User.forge({
                    username: form.data.username
                }).fetch()
            ]);
        }).spread(function (form, user) {
            if (user) throw 'Username already taken';
            return models.User.forge({
                username: form.data.username,
                email: form.data.email
            }).hashPassword(form.data.password).save();
        }).then(function (user) {
            req.flash('message', {
                level: 'success',
                message: 'You may now sign in'
            });
            res.redirect('/auth/login');
        }).catch(function (err) {
            req.flash('signupMessage', util.inspect(err));
            res.redirect('/auth/signup');
        });
    });

    app.get('/auth/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });

};
