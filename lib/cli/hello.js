export default function (program, init) {
  program.command('hello')
    .description('Say hello!')
    .action(init(cmd));
}

function cmd (args, options, shared) {
  console.log("HELLO!", args, options, shared);
}
