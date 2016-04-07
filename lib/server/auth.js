import passport from 'passport';
import _ from 'lodash';
import EveOnlineStrategy from 'passport-eveonline';

import { Character, Characters } from '../models';

export default function (options, shared, app) {
  const logger = shared.logger;

  const strategy = new EveOnlineStrategy(
    shared.config.sso,
    (characterInformation, done) => {
      Character.forge({
        CharacterID: characterInformation.CharacterID,
      }).createOrUpdate(_.pick(characterInformation, [
        'CharacterName', 'ExpiresOn', 'Scopes', 'CharacterOwnerHash',
        'accessToken', 'refreshToken'
      ])).then(result => {
        done(null, result);
      });
    }
  );

  // Monkeypatch _verify so we get tokens for CREST calls
  strategy._verify = function(accessToken, refreshToken, characterInformation, done) {
    Object.assign(characterInformation, { accessToken, refreshToken });
    return this._verifyCallback(characterInformation, done);
  };

  passport.use(strategy);

  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    Character.forge({id: id}).fetch().then(user => {
      done(null, user);
    });
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
