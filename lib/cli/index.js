import requireDir from 'require-dir';
import program from 'commander';
import { initShared } from '../index';

const package_json = require(__dirname + '/../../package.json');
program.version(package_json.version)
  .option('-D, --debug', 'enable debugging and debug output')
  .option('-q, --quiet', 'quiet output, except for errors')
  .option('-v, --verbose', 'enable verbose output');

function init (next) {
  return (...args) => {
    const options = args.pop();
    initShared(args, options, next);
  }
}

const cmds = requireDir();
for (const name in cmds) {
  cmds[name].default(program, init);
}

export default function (argv) {
  program.parse(process.argv);
  if (!process.argv.slice(2).length) {
    program.outputHelp();
    process.exit(0);
  }
};
