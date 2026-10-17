import ts from 'typescript';

export interface CapacitySelector {
  type:
    | 'schema-call'
    | 'declaration'
    | 'property'
    | 'comparison'
    | 'string-number'
    | 'statement-timeout';
  name?: string;
  method?: string;
  left?: string;
  text?: string;
}
export interface CapacityBudget {
  id: string;
  kind: 'configured-default' | 'configuration-ceiling' | 'hard-cap';
  value: number;
  unit: string;
  scope: string;
  source: string;
  selector: CapacitySelector;
}
export interface CapacityPolicy {
  schemaVersion: number;
  status: string;
  budgets: CapacityBudget[];
  loadTargets: {
    sampleCount: number;
    concurrency: number;
    p95Ms: number;
    p99Ms: number;
    classification: string;
  };
}
function numeric(node: ts.Node): number | undefined {
  if (ts.isNumericLiteral(node)) return Number(node.text.replaceAll('_', ''));
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) {
    const left = numeric(node.left),
      right = numeric(node.right);
    return left === undefined || right === undefined ? undefined : left * right;
  }
  return undefined;
}
/** Reads syntax only: does not execute configuration, initialize clients or consult process.env. */
export function sourceBudgetValues(text: string, selector: CapacitySelector): number[] {
  const source = ts.createSourceFile('capacity-source.ts', text, ts.ScriptTarget.Latest, true);
  const values: number[] = [];
  const take = (node: ts.Node | undefined) => {
    if (!node) return;
    const value = numeric(node);
    if (value !== undefined) values.push(value);
  };
  function visit(node: ts.Node) {
    if (
      selector.type === 'declaration' &&
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === selector.name
    )
      take(node.initializer);
    if (
      selector.type === 'property' &&
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === selector.name
    )
      take(node.initializer);
    if (
      selector.type === 'schema-call' &&
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === selector.name
    ) {
      function calls(child: ts.Node) {
        if (
          ts.isCallExpression(child) &&
          ts.isPropertyAccessExpression(child.expression) &&
          child.expression.name.text === selector.method
        )
          take(child.arguments[0]);
        ts.forEachChild(child, calls);
      }
      calls(node.initializer);
    }
    if (
      selector.type === 'comparison' &&
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.GreaterThanToken &&
      node.left.getText(source) === selector.left
    )
      take(node.right);
    if (ts.isStringLiteral(node)) {
      if (selector.type === 'string-number' && node.text === selector.text)
        values.push(Number(node.text));
      if (selector.type === 'statement-timeout') {
        const match = /^SET LOCAL statement_timeout='(\d+)ms'$/.exec(node.text);
        if (match) values.push(Number(match[1]));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return values;
}
export function capacityPolicyErrors(
  policy: CapacityPolicy,
  read: (file: string) => string,
): string[] {
  const errors: string[] = [];
  if (policy.schemaVersion !== 1) errors.push('Unsupported capacity policy schema');
  const ids = new Set<string>();
  for (const budget of policy.budgets) {
    if (ids.has(budget.id)) errors.push(`Duplicate budget: ${budget.id}`);
    ids.add(budget.id);
    if (
      !Number.isSafeInteger(budget.value) ||
      budget.value < 0 ||
      !budget.unit ||
      !budget.scope ||
      !['configured-default', 'configuration-ceiling', 'hard-cap'].includes(budget.kind)
    )
      errors.push(`Invalid budget: ${budget.id}`);
    if (!/^api\/src\/[A-Za-z0-9/]+\.ts$/.test(budget.source)) {
      errors.push(`Unsafe source: ${budget.id}`);
      continue;
    }
    const values = sourceBudgetValues(read(budget.source), budget.selector);
    if (!values.length || values.some((value) => value !== budget.value))
      errors.push(`Source drift: ${budget.id}`);
  }
  const targets = policy.loadTargets;
  if (
    targets.classification !== 'provisional-engineering-target' ||
    targets.sampleCount !== 100 ||
    targets.concurrency !== 4 ||
    targets.p95Ms !== 2000 ||
    targets.p99Ms !== 5000
  )
    errors.push('Load target contract changed; review the load runner and policy together');
  return errors;
}
