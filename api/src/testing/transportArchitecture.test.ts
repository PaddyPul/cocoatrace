import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
const root = path.resolve(__dirname, '../../..');
function inspect(file: string) {
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
it('shipment HTTP adapters cannot acquire database or workflow transaction dependencies', () => {
  const source = inspect('api/src/controllers/shipmentController.ts');
  expect(source.imports).toEqual([
    'express',
    '../modules/transportWorkflow/model',
    '../modules/transportWorkflow/service',
  ]);
  expect(
    source.literals.some((value) =>
      /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|COMMIT|ROLLBACK)\b/.test(value),
    ),
  ).toBe(false);
});
it('transport workflow and delivery use cases do not depend on the HTTP framework', () => {
  const directory = path.join(root, 'api/src/modules/transportWorkflow');
  for (const file of fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))) {
    expect(inspect('api/src/modules/transportWorkflow/' + file).imports, file).not.toContain(
      'express',
    );
  }
  expect(inspect('api/src/modules/delivery/workflow.ts').imports).not.toContain('express');
});
it('transport transition policy cannot access persistence or network frameworks', () => {
  const source = inspect('api/src/modules/transportWorkflow/policy.ts');
  expect(
    source.imports.every((name) => !/(^express$|^pg$|^knex$|\/db$|repository|service$)/.test(name)),
  ).toBe(true);
  expect(
    source.literals.some((value) =>
      /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|COMMIT|ROLLBACK)\b/.test(value),
    ),
  ).toBe(false);
});
