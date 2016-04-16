export default function (program, init) {
  program.command('watchexports')
    .description('watch for and process market exports')
    .action(init(cmd));
};

import os from 'os';
import fs from 'fs';
import path from 'path';
import Promise from 'bluebird';
import _ from 'lodash';
import {Character, Characters, MarketType, MarketTypes} from '../models';

function cmd (args, options, shared) {
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

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}
