// The plan's screen list and the app's route files must match both ways, so a screen
// cannot be added to the plan without a route, or to the app without the plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SCREENS } from '../src/screens';

const root = join(import.meta.dirname, '..');
const routes = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? routes(p) : [relative(root, p)];
});

test('every planned screen has its route file', () => {
  assert.ok(SCREENS.length >= 9, 'the plan names at least nine screens');
  for (const s of SCREENS) assert.ok(existsSync(join(root, s.file)), `${s.route}: missing ${s.file}`);
});

test('every route file is a planned screen (layouts and the start redirect aside)', () => {
  const files = routes(join(root, 'app')).filter(f => !/(^|\/)_layout\.tsx$/.test(f) && f !== 'app/index.tsx' && f !== 'app/+native-intent.ts' && f !== 'app/+not-found.tsx');
  assert.ok(files.length > 0, 'found route files');
  const planned = new Set(SCREENS.map(s => s.file));
  for (const f of files) assert.ok(planned.has(f), `${f} is not in src/screens.ts`);
});
