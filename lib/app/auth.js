var util = require('util');

var passport = require('passport');
var models = require('../models');
var eveData = require('../eveData');
var appForms = require('../forms');

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
passport.use('local-login', new LocalStrategy({
    usernameField : 'username',
    passwordField : 'password',
    passReqToCallback : true
},
function(req, username, password, done) {
    models.User.forge({ username: username }).fetch()
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

module.exports = function (app) {

    app.get('/auth/login', function (req, res) {
        res.render('auth/login.html', {
            message: req.flash('loginMessage')
        });
    });

    app.post('/auth/login', passport.authenticate('local-login', {
        successRedirect : '/auth/profile',
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
        form.handle(req, {
            error: function (form) {
                res.render('auth/signup.html', {
                    form: form,
                    message: req.flash('signupMessage')
                });
            },
            empty: function (form) {
                res.redirect('/auth/signup');
            },
            success: function (form) {
                models.User.forge({ username: form.data.username })
                    .fetch({ require: true })
                    .then(function (user) {
                        req.flash('signupMessage',
                            'That username is already taken.');
                        res.render('auth/signup.html', {
                            form: form,
                            message: req.flash('signupMessage')
                        });
                    })
                    .catch(function (err) {
                        var newUser = new models.User({
                            username: form.data.username,
                            email: form.data.email
                        });
                        newUser.hashPassword(form.data.password);
                        newUser.save().then(function() {
                            req.login(newUser, function (err) {
                                if (err) {
                                    req.flash('signupMessage',
                                        'Error saving new user.');
                                    res.redirect('/auth/signup');
                                } else {
                                    res.redirect('/auth/profile');
                                }
                            });
                        })
                        .catch(function (err) {
                            req.flash('signupMessage',
                                'Error saving new user.');
                            res.redirect('/auth/signup');
                        });
                    })
            }
        });
    });

    app.get('/auth/profile', function (req, res) {
        res.render('auth/profile.html', {
            //user: req.user
        });
    });

    app.get('/auth/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });

};
