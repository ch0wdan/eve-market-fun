import passport from 'passport';
import EveOnlineStrategy from 'passport-eveonline';

export default function (options, shared, app) {
  const logger = shared.logger;

  passport.use(new EveOnlineStrategy(
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
  ));

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

  app.get('/auth/eveonline', passport.authenticate('eveonline'));

  app.get('/auth/eveonline/callback', passport.authenticate('eveonline', {
    successRedirect: '/',
    failureRedirect: '/login'
  }));

}
