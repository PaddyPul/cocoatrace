import fs from 'node:fs';
import path from 'node:path';
import { discoverRoutes, repositoryRoot, validateRegister } from './authorization-register.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== '--update-routes'))
    throw new Error(
      'Use no arguments to check, or --update-routes after reviewing source and policy metadata',
    );
  const file = path.join(repositoryRoot, 'docs/security/route-authorization.json');
  const register = JSON.parse(fs.readFileSync(file, 'utf8'));
  const actual = discoverRoutes();
  const candidate = args.length ? { ...register, routes: actual } : register;
  validateRegister(candidate, actual);
  if (args.length) fs.writeFileSync(file, JSON.stringify(candidate, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: 'passed',
      routes: actual.length,
      sessionRoutes: actual.filter((row) => row.authentication === 'session').length,
      permissionRoutes: actual.filter((row) => row.guards.some((guard) => guard.kind !== 'session'))
        .length,
      resourceMatrix: 'partial; policy/test pointers do not prove every resource/role combination',
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Authorization inventory unavailable');
  process.exitCode = 1;
}
