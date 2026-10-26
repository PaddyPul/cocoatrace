import fs from 'node:fs';
import path from 'node:path';

export function browserSuiteArguments(args, root) {
  if (args.length > 8) throw new Error('Select at most eight browser suite filenames');
  return args.map((name) => {
    if (
      !/^[A-Za-z0-9_-]+\.spec\.ts$/.test(name) ||
      !fs.statSync(path.join(root, 'e2e', name), { throwIfNoEntry: false })?.isFile()
    )
      throw new Error('Select an existing e2e spec filename; options and paths are not accepted');
    return `e2e/${name}`;
  });
}
