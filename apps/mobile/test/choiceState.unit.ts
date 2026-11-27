// Every radio and checkbox tells the web build and screen readers whether it is chosen.
// react-native-web drops accessibilityState, so a choice that only sets it reads as a dead
// control on the preview: the tap-through failed STATE_HIDDEN on the packet's Letter/A4 and the
// add-task window radios (main 3912c05, 27 Nov 2026). aria-checked works on iOS, Android and web.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const tsx = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? tsx(p) : p.endsWith('.tsx') ? [p] : [];
});

type Choice = { file: string; line: number; ariaChecked: boolean };
function choices(file: string): Choice[] {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Choice[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const attrs = n.attributes.properties.filter(ts.isJsxAttribute);
      const role = attrs.find(a => a.name.getText(src) === 'accessibilityRole' || a.name.getText(src) === 'role');
      const roleText = role?.initializer?.getText(src) ?? '';
      if (/['"](radio|checkbox)['"]/.test(roleText)) {
        out.push({ file, line: src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1, ariaChecked: attrs.some(a => a.name.getText(src) === 'aria-checked') });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

const all = [...tsx(join(root, 'app')), ...tsx(join(root, 'src'))].flatMap(choices);

test('the app has radios and checkboxes to check (an empty sweep proves nothing)', () => {
  assert.ok(all.length >= 10, `found ${all.length} radios/checkboxes`);
  assert.ok(all.some(c => c.file.endsWith('packet.tsx')), 'the packet paper radios are swept');
  assert.ok(all.some(c => c.file.endsWith('add-task.tsx')), 'the add-task window radios are swept');
});

test('every radio and checkbox sets aria-checked, so web and screen readers see its state', () => {
  const hidden = all.filter(c => !c.ariaChecked).map(c => `${c.file.slice(root.length + 1)}:${c.line}`);
  assert.deepEqual(hidden, [], `set aria-checked on: ${hidden.join(', ')}`);
});
