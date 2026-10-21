import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function controllerViolations(source) {
  const file = ts.createSourceFile('controller.ts', source, ts.ScriptTarget.Latest, true);
  const violations = new Set();
  function inspect(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (
        /(?:^|\/)db(?:\.js|\.ts)?$/.test(node.moduleSpecifier.text) ||
        ['pg', 'pg-pool', 'knex'].includes(node.moduleSpecifier.text)
      )
        violations.add('database import');
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (
        (ts.isIdentifier(expression) && ['query', 'getClient'].includes(expression.text)) ||
        (ts.isPropertyAccessExpression(expression) && expression.name.text === 'query')
      )
        violations.add('database call');
      if (
        ((ts.isIdentifier(expression) && expression.text === 'require') ||
          expression.kind === ts.SyntaxKind.ImportKeyword) &&
        node.arguments.some(
          (argument) =>
            ts.isStringLiteral(argument) && /(?:^|\/)db$|^pg$|^knex$/.test(argument.text),
        )
      )
        violations.add('database require');
    }
    if (
      (ts.isStringLiteralLike(node) || ts.isTemplateHead(node)) &&
      /^\s*(?:SELECT\b|WITH\s+\w+\s+AS\s*\(|INSERT\s+INTO\b|UPDATE\s+[\w."]+\s+SET\b|DELETE\s+FROM\b|BEGIN(?:\s|$)|COMMIT(?:\s|$)|ROLLBACK(?:\s|$))/i.test(
        node.text,
      )
    )
      violations.add('SQL literal');
    ts.forEachChild(node, inspect);
  }
  inspect(file);
  return [...violations].sort();
}
export function checkControllerBoundaries(root) {
  let count = 0;
  const failures = [];
  function scan(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) scan(target);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        count++;
        const errors = controllerViolations(fs.readFileSync(target, 'utf8'));
        if (errors.length) failures.push(`${path.relative(root, target)}: ${errors.join(', ')}`);
      }
    }
  }
  scan(path.join(root, 'api/src/controllers'));
  if (!count) throw new Error('Controller boundary inventory is empty');
  if (failures.length) throw new Error(failures.join('\n'));
  return count;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  console.log(
    `Controller boundaries passed: ${checkControllerBoundaries(root)} controller files, no direct database access.`,
  );
}
