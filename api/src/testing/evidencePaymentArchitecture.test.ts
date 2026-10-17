import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
const root = path.resolve(__dirname, '../../..');
function imports(file: string) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(path.join(root, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const modules: string[] = [],
    strings: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
      modules.push(node.moduleSpecifier.text);
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    )
      strings.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { modules, strings };
}
it.each(['evidenceController', 'paymentController'])(
  '%s cannot query or transact directly',
  (name) => {
    const source = imports(`api/src/controllers/${name}.ts`);
    expect(
      source.modules.some((value) => /(^pg$|^knex$|^fs$|^path$|\/db$|\/transaction$)/.test(value)),
    ).toBe(false);
    expect(
      source.strings.some((value) =>
        /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|COMMIT|ROLLBACK)\b/.test(value),
      ),
    ).toBe(false);
  },
);
it.each([
  'evidenceWorkflow/policy',
  'evidenceWorkflow/download',
  'evidenceWorkflow/repository',
  'evidenceWorkflow/storage',
  'payments/requestPolicy',
  'payments/requests',
])('%s stays independent of Express', (name) => {
  expect(imports(`api/src/modules/${name}.ts`).modules).not.toContain('express');
});
it.each(['evidenceWorkflow/policy', 'payments/requestPolicy'])(
  '%s keeps persistence out of pure decisions',
  (name) => {
    const source = imports(`api/src/modules/${name}.ts`);
    expect(source.modules.some((value) => /(^pg$|^knex$|\/db$|\/repository$)/.test(value))).toBe(
      false,
    );
  },
);
