export default function (program, init) {
  program.command('server')
    .description('Start the web server')
    .action(init(cmd));
}

import os from 'os';
import fs from 'fs';
import path from 'path';
import {setInterval} from 'timers';
import Promise from 'bluebird';
import _ from 'lodash';
import {Character, Characters, MarketType, MarketTypes, ApiKey, ApiKeys} from '../models';

import Server from '../server';

function cmd (args, options, shared) {
  const UPDATE_INTERVAL = 5 * 60 * 1000;

  startServer(args, options, shared);
  watchExports(args, options, shared);
  setInterval(() => updateCharacters(args, options, shared), UPDATE_INTERVAL);
}

function startServer (args, options, shared) {
  const logger = shared.logger;
  Server(options, shared).then(function (server) {
    logger.info('Server listening on port ' + server.port);
  }).catch(function (err) {
    logger.error(err);
  });
}

function getUserHome () {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function watchExports (args, options, shared) {
  const logger = shared.logger;

  const LOGS_PATH = getUserHome() + '/Documents/EVE/logs/Marketlogs';

  const handleMarketExport = _.debounce(function (filepath) {
    MarketTypes.parseExportCSV(filepath).then(types => {
      _.each(types, function (type) {
        logger.debug("Updated typeID", type.get('typeID'),
                     "for region", type.get('regionID'));
      });
      logger.info("Updated", types.length, "types");
    });
  }, 300);

  const handleOrdersExport = _.debounce(filepath => {
    Characters.parseExportCSV(filepath).then(results => {
      logger.info("Updated orders for", results.length, "characters");
    });
  }, 300);

  fs.watch(LOGS_PATH, function (event, filename) {
    if ('change' == event) {
      const filepath = path.join(LOGS_PATH, filename);
      if (filename.indexOf('My Orders') === 0) {
        handleOrdersExport(filepath);
      } else {
        handleMarketExport(filepath);
      }
    }
  });
}

function updateCharacters (args, options, shared) {
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
