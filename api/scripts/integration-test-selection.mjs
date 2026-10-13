import fs from 'node:fs';
import path from 'node:path';
export function integrationSuiteArguments(args, root) {
  if (
    args.length > 1 ||
    (args.length === 1 &&
      (!/^[A-Za-z][A-Za-z0-9]*\.integration\.test\.ts$/.test(args[0]) ||
        !fs.existsSync(path.join(root, 'api/test/integration', args[0]))))
  ) {
    throw new Error(
      'Supply one existing integration suite filename, or no argument for the full suite.',
    );
  }
  return args.length ? ['--', `test/integration/${args[0]}`] : [];
}
