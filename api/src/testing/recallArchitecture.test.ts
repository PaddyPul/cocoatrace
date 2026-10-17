import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
const root = path.resolve(__dirname, '../../..');
function inspect(name: string) {
  const file = `api/src/modules/recall/${name}.ts`;
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(path.join(root, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports: string[] = [],
    literals: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
      imports.push(node.moduleSpecifier.text);
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    )
      literals.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { imports, literals };
}
it.each(['lifecycle', 'notifications', 'response'])(
  '%s orchestration leaves SQL in repositories',
  (name) => {
    const source = inspect(name);
    expect(
      source.literals.some((value) =>
        /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|BEGIN|COMMIT|ROLLBACK)\b/.test(value),
      ),
    ).toBe(false);
  },
);
it.each([
  'lifecycle',
  'notifications',
  'response',
  'policy',
  'activationRepository',
  'notificationRepository',
  'responseRepository',
])('%s remains independent of Express', (name) => {
  expect(inspect(name).imports).not.toContain('express');
});
it('recall authority policy cannot import persistence or workflow services', () => {
  expect(
    inspect('policy').imports.some((name) =>
      /(^pg$|^knex$|^express$|\/db$|[Rr]epository|\/response$|\/lifecycle$)/.test(name),
    ),
  ).toBe(false);
});
