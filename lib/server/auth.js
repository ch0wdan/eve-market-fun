import passport from 'passport';
import EveOnlineStrategy from 'passport-eveonline';

export default function (options, shared, app) {
  const logger = shared.logger;

  const strategy = new EveOnlineStrategy(
    shared.config.sso,
    (characterInformation, done) => {
      done(null, characterInformation);
      /*
      User.findOrCreate(
        { characterID: characterInformation.characterID },
        function (err, user) {
          return done(err, user);
        }
      );
      */
    }
  );

  // Monkeypatch _verify so we get tokens for CREST calls
  strategy._verify = function(accessToken, refreshToken, characterInformation, done) {
    Object.assign(characterInformation, { accessToken, refreshToken });
    return this._verifyCallback(characterInformation, done);
  };

  passport.use(strategy);

  passport.serializeUser(function(user, done) {
    done(null, JSON.stringify(user));
    /*
    done(null, user.id);
    */
  });

  passport.deserializeUser(function(user, done) {
    done(null, JSON.parse(user));
    /*
    User.findById(id, function (err, user) {
      done(err, user);
    });
    */
  });

  app.get('/auth/login', passport.authenticate('eveonline'));

  app.get('/auth/logout', function(req, res){
    req.logout();
    res.redirect('/');
  });

  app.get('/auth/eveonline/callback', passport.authenticate('eveonline', {
    successRedirect: '/',
    failureRedirect: '/login'
  }));

}
