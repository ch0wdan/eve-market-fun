import winston from 'winston';
import Knex from 'knex';

import config from '../config';
import eveData from './eveData';
import { db } from './models';

export function initShared (args, options, next) {
  config.log_level = options.parent.debug ? 'debug' :
    options.parent.verbose ? 'silly' :
    options.parent.quiet ? 'error' :
    config.log_level;

  const logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({
        level: config.log_level,
        colorize: true
      })
    ]
  });

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
