import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const publicExceptions = new Map([
  ['GET /health', 'database liveness metadata'],
  ['GET /health/live', 'process metadata'],
  ['GET /health/ready', 'dependency readiness metadata'],
  ['POST /auth/login', 'credential authentication'],
  ['POST /auth/password/forgot', 'non-enumerating reset request'],
  ['POST /auth/password/reset', 'single-use reset capability'],
  ['POST /auth/request-access', 'rate-limited organization application'],
  ['POST /auth/request-access/verify', 'single-use verification capability'],
  ['GET /auth/invitations/:token', 'invitation capability projection'],
  ['POST /auth/invitations/:token/accept', 'single-use invitation capability'],
  ['GET /public/products/:slug/notices/page', 'published recall projection'],
  ['GET /public/products/:slug/journey/page', 'published journey projection'],
  ['GET /public/products/:slug/evidence/page', 'published approved-evidence projection'],
  ['GET /public/products/:slug', 'published product projection'],
  ['GET /public/products/:slug/qr.svg', 'published product QR projection'],
  ['POST /public/products/:slug/scans', 'bounded public scan recording'],
]);
export const capabilityRoute = 'PUT /evidence/upload-intents/:id/content';
const verbs = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const literal = (node) => {
  if (!node || !ts.isStringLiteral(node))
    throw new Error('Authorization inventory requires literal route/permission strings');
  return node.text;
};
function guards(nodes) {
  const result = [];
  for (const node of nodes) {
    if (ts.isIdentifier(node) && node.text === 'requireAuth') result.push({ kind: 'session' });
    else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ['requirePermission', 'requireAnyPermission'].includes(node.expression.text)
    ) {
      const values = node.arguments.map(literal);
      if (!values.length || (node.expression.text === 'requirePermission' && values.length !== 1))
        throw new Error('Unsupported permission guard');
      result.push({
        kind: node.expression.text === 'requirePermission' ? 'all' : 'any',
        permissions: values,
      });
    }
  }
  return result;
}
function includesPrefix(route, prefix) {
  return (
    prefix === '/' ||
    route === prefix ||
    route.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')
  );
}
/** Parse the standard router DSL without executing application configuration or provider code. */
export function extractRoutes(source, filename) {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const inherited = [],
    routes = [];
  let routerBindings = 0;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isElementAccessExpression(node.expression) &&
      ['router', 'app'].includes(node.expression.expression.getText(tree))
    ) {
      throw new Error(
        `Computed router registration requires explicit inventory support in ${filename}`,
      );
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(tree) === 'Router'
    ) {
      routerBindings++;
      if (node.name.getText(tree) !== 'router' || routerBindings > 1)
        throw new Error(`Unsupported router binding in ${filename}`);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression.getText(tree),
        method = node.expression.name.text;
      if (receiver === 'router' || (receiver === 'app' && filename === 'api/src/app.ts')) {
        if (method === 'use') {
          const security = guards(
            node.arguments.slice(ts.isStringLiteral(node.arguments[0]) ? 1 : 0),
          );
          if (security.length)
            inherited.push({
              prefix: ts.isStringLiteral(node.arguments[0]) ? literal(node.arguments[0]) : '/',
              guards: security,
            });
        } else if (verbs.has(method)) {
          const route = literal(node.arguments[0]);
          const all = [
            ...inherited
              .filter((rule) => includesPrefix(route, rule.prefix))
              .flatMap((rule) => rule.guards),
            ...guards(node.arguments.slice(1)),
          ];
          const handler = node.arguments.at(-1);
          const entryControls = node.arguments
            .slice(1)
            .filter(
              (arg) =>
                ['sensitiveActionLimit', 'evidenceContentHandler'].includes(arg.getText(tree)) ||
                (ts.isCallExpression(arg) &&
                  arg.expression.getText(tree) === 'publicActionLimiter'),
            )
            .map((arg) => arg.getText(tree).replaceAll(/\s+/g, ' '));
          routes.push({
            method: method.toUpperCase(),
            path: route,
            source: filename,
            guards: all,
            entryControls,
            handler:
              ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)
                ? 'inline'
                : handler.getText(tree),
          });
        } else if (receiver === 'router' || ['all', 'route'].includes(method))
          throw new Error(`Unsupported router registration ${method} in ${filename}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return routes;
}
function resolveImport(root, file, relative) {
  const base = path.resolve(path.dirname(path.join(root, file)), relative);
  const candidates = [base + '.ts', path.join(base, 'index.ts')];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) return null; // Non-TS assets are outside the HTTP router DSL.
  const resolved = path.relative(root, found).split(path.sep).join('/');
  if (!resolved.startsWith('api/src/'))
    throw new Error('Source import escapes authorization inventory scope');
  return resolved;
}
export function discoverRoutes(root = repositoryRoot) {
  const pending = ['api/src/app.ts'],
    seen = new Set(),
    routes = [];
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    routes.push(...extractRoutes(source, file));
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const node of tree.statements)
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.startsWith('.')
      ) {
        const resolved = resolveImport(root, file, node.moduleSpecifier.text);
        if (resolved) pending.push(resolved);
      }
  }
  const keys = new Set();
  return routes
    .sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`, 'en'))
    .map((route) => {
      const key = `${route.method} ${route.path}`;
      if (keys.has(key)) throw new Error(`Duplicate route ${key}`);
      keys.add(key);
      const session = route.guards.some((guard) => guard.kind === 'session');
      const authentication =
        key === capabilityRoute
          ? 'upload-capability'
          : publicExceptions.has(key)
            ? 'public-or-token'
            : 'session';
      if (session && route.guards[0]?.kind !== 'session')
        throw new Error(`Authentication must precede permission guards: ${key}`);
      if (
        key === capabilityRoute &&
        (!route.entryControls.includes('evidenceContentHandler') ||
          route.handler !== 'evidenceContentHandler')
      )
        throw new Error('Upload capability route must retain its capability-aware body handler');
      if (authentication === 'session' && !session)
        throw new Error(`Unreviewed anonymous surface: ${key}`);
      if (authentication !== 'session' && session)
        throw new Error(`Public exception now protected; review ${key}`);
      return { ...route, authentication };
    });
}
export function validateRegister(register, actual, root = repositoryRoot) {
  if (register.version !== 1 || JSON.stringify(register.routes) !== JSON.stringify(actual))
    throw new Error(
      'Authorization route register differs from source. Review and update it before release.',
    );
  const sources = [...new Set(actual.map((route) => route.source))].sort();
  if (JSON.stringify(Object.keys(register.policies).sort()) !== JSON.stringify(sources))
    throw new Error('Every route source needs exactly one reviewed resource-policy entry');
  for (const [source, policy] of Object.entries(register.policies)) {
    if (
      typeof policy.scope !== 'string' ||
      policy.scope.length < 30 ||
      !Array.isArray(policy.evidence) ||
      !policy.evidence.length ||
      typeof policy.remaining !== 'string' ||
      !policy.remaining.length
    )
      throw new Error(`Incomplete resource-policy evidence for ${source}`);
    for (const file of policy.evidence)
      if (
        typeof file !== 'string' ||
        !file.startsWith('api/') ||
        file.includes('..') ||
        !fs.existsSync(path.join(root, file))
      )
        throw new Error(`Missing policy/test evidence for ${source}`);
  }
  for (const key of publicExceptions.keys())
    if (!actual.some((route) => `${route.method} ${route.path}` === key))
      throw new Error(`Stale public exception ${key}`);
  if (!actual.some((route) => `${route.method} ${route.path}` === capabilityRoute))
    throw new Error('Missing reviewed upload capability route');
}
