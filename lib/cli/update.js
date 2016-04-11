export default function (program, init) {
  program.command('update')
    .description('update data for all API keys')
    .action(init(cmd));
}

import {Character, Characters, ApiKey, ApiKeys} from '../models';
import Promise from 'bluebird';

function cmd (args, options, shared) {
  const logger = shared.logger;

  // TODO: Convert this to an async queue, monitor progress?
  ApiKeys.forge().fetch().then(keys =>
    Promise.map(keys.toArray(), key =>
      key.characters().fetch().then(characters =>
        Promise.map(characters.toArray(), character =>
          character.update(key).then(result => {
            logger.info("Updated " + character.get('characterName'));
            logger.debug("\t" + Object.keys(result.transactions).length + " transactions");
            logger.debug("\t" + Object.keys(result.journal).length + " journal entries");
            logger.debug("\t" + Object.keys(result.orders).length + " orders");
          })
        )
      )
    )
  )
  .catch(err => logger.error(err))
  .finally(() => shared.exit());
}
