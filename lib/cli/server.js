export default function (program, init) {
  program.command('server')
    .description('Start the web server')
    .action(init(cmd));
}

import Server from '../server';

function cmd (args, options, shared) {
  const logger = shared.logger;
  Server(options, shared).then(function (server) {
    logger.info('Server listening on port ' + server.port);
  }).catch(function (err) {
    logger.error(err);
  });
}
