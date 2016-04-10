export default function (program, init) {
  program.command('apikeys:add <keyID> <vCode>')
    .description('add an API key')
    .action(init(cmd));
}

import {Character, Characters, ApiKey, ApiKeys} from '../models';
import Promise from 'bluebird';

function cmd (args, options, shared) {
  var logger = shared.logger;

  var keyID = args.shift();
  var vCode = args.shift();

  ApiKey.forge({keyID}).createOrUpdate({vCode})
    .then(key => key.update())
    .then(key => {
      logger.info('API key', key.get('keyID'), 'updated:');
      logger.debug(JSON.stringify(key.toJSON(), null, ' '));
      key.characters().fetch().then(characters => {
        characters.each(character => {
          logger.debug(JSON.stringify(character.toJSON(), null, ' '));
        });
      }).then(shared.exit);
    })
    .catch(err => {
      logger.error(err);
      return shared.exit();
    });
}
