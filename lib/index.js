import winston from 'winston';

import eveData from './eveData';

function configure (options) {
  // TODO: Use a better config format, also check env vars and CLI options
  return Object.assign({
    port: 9001,
    secret: '8675309jenny'
  }, require('../config'));
}

export function initShared (args, options, next) {
  const config = configure(options);

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

  const exit = function () {
    //shared.db.close();
    eveData.close();
    process.exit();
  };

  next(args, options, { config, logger, exit });
}
