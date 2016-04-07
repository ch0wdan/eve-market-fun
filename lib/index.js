import winston from 'winston';
import Knex from 'knex';

import config from '../config';
import eveData from './eveData';
import { db } from './models';

export function initShared (args, options, next) {
  config.log_level = options.debug ? 'debug' :
    options.verbose ? 'verbose' :
    options.quiet ? 'error' :
    config.log_level;

  const logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({
        level: config.log_level,
        colorize: true
      })
    ]
  });

  logger.setLevels({ silly: 0, debug: 1, verbose: 2,
                     info: 3, warn: 4, error: 5 });

  const shared = {config, logger};

  shared.exit = () => {
    db.destroy();
    eveData.close();
    process.exit();
  };

  eveData.open(config.eveDB, dbEVE => {
    next(args, options, shared);
  });
}
