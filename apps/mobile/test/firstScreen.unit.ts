// A fresh install's first screen leads with the no-account line (fresh review, 21 Nov 2026:
// the line was on /welcome, which a new install only reaches later).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { firstRoute, NO_ACCOUNT_LINE } from '../src/firstScreen';
import { byRoute } from '../src/screens';

test('a fresh install opens the free journey, and a saved plan opens the plan', () => {
  assert.equal(firstRoute(null), '/feel');
  assert.equal(firstRoute('2027-06-12'), '/plan');
  assert.equal(firstRoute(''), '/plan'); // "no date yet" was chosen: she has a plan
});

test('the first step of the first screen shows the no-account line', () => {
  assert.match(NO_ACCOUNT_LINE, /no account/i);
  assert.doesNotMatch(NO_ACCOUNT_LINE, /track/i);
  const file = byRoute(firstRoute(null)).file;
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  // Find the `step === 1 ? <>…</> : …` branch and require the line inside it.
  let stepOne: ts.Node | undefined;
  (function visit(node: ts.Node) {
    if (ts.isConditionalExpression(node) && /^step\s*===\s*1$/.test(node.condition.getText(source))) stepOne ??= node.whenTrue;
    ts.forEachChild(node, visit);
  })(source);
  assert.ok(stepOne, `${file} has no step 1 branch`);
  assert.match(stepOne!.getText(source), /\{NO_ACCOUNT_LINE\}/);
});
