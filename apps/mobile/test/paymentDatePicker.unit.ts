import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
test('payment calendar selection updates the payment date while preserving the amount', () => {
  const source = ts.createSourceFile('payments.tsx', readFileSync('app/(tabs)/payments/index.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const pickers: ts.JsxSelfClosingElement[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'WeddingDatePicker') pickers.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(pickers.length, 1);
  const props = pickers[0].attributes.properties;
  const change = props.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === 'onChange') as ts.JsxAttribute;
  const value = props.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === 'value') as ts.JsxAttribute;
  assert.ok(change?.initializer && ts.isJsxExpression(change.initializer));
  assert.ok(value?.initializer && ts.isJsxExpression(value.initializer));
  const editing = { id: 'own:example', date: '2027-06-12', cents: 12345 };
  assert.equal(runInNewContext(value.initializer.expression!.getText(source), { editing }), editing.date);
  let saved = editing;
  const callback = ts.transpile(`(${change.initializer.expression!.getText(source)})`, { target: ts.ScriptTarget.ES2022 });
  runInNewContext(callback, { editing, setEditing: (row: typeof editing) => { saved = row; } })('2027-05-10');
  assert.equal(saved.date, '2027-05-10');
  assert.equal(saved.cents, editing.cents);
  assert.equal(saved.id, editing.id);
});
