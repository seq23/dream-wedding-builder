import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

test('reachable screen literals never expose internal build instructions', () => {
  let checked = 0;
  function scan(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { scan(path); continue; }
      if (!/\.tsx?$/.test(path)) continue;
      const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) {
          checked++;
          assert.doesNotMatch(node.text, /\bCodex\b|\btask\s+\d+/i, path);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  scan('app'); scan('src');
  assert.ok(checked > 0);
});
