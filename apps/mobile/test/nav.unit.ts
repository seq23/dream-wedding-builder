// Navigation map checks (make-it-calm section 7; her tap-through, 6 Nov 2026: "i cant go
// back or back to home or esc"). The shell and headers draw Back, Close, Skip and the tab
// bar from src/screens.ts, so the map being right is the app being navigable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOME, SCREENS, TABS, byRoute } from '../src/screens';

const root = join(import.meta.dirname, '..');
const routeOfFile = (file: string) => '/' + file.replace(/^app\//, '').replace(/\(tabs\)\//, '').replace(/\/index\.tsx$|\.tsx$/, '');

test('each route in the map is the URL its file really serves', () => {
  for (const s of SCREENS) assert.equal(routeOfFile(s.file), s.route, s.file);
  assert.ok(TABS.some(t => t.route === HOME), 'home is a tab');
});

test('every screen reaches the plan in one tap', () => {
  for (const s of SCREENS) {
    const oneTap =
      s.kind !== 'onboarding' ? !!s.tab                                       // the tab bar, with Plan on it (sheets too)
      : s.links.some(l => l.label === 'Skip ›' && l.href === HOME);           // onboarding: Skip ›
    assert.ok(oneTap, `${s.route} (${s.kind}) has no one-tap way to the plan`);
  }
});

test('every sub-screen and sheet has Back inside its own tab, so Android back never leaves the app', () => {
  for (const s of SCREENS.filter(x => x.kind === 'sub' || x.kind === 'sheet')) {
    assert.ok(s.tab && s.back, `${s.route} needs a tab and a back`);
    const parent = byRoute(s.back!);
    assert.equal(parent.tab, s.tab, `${s.route} goes back out of its tab`);
    assert.ok(s.file.startsWith(`app/(tabs)/${s.tab}/`), `${s.route} must live in its tab's stack folder to keep the tab bar`);
    let p = parent, hops = 0;
    while (p.back && hops++ < 10) p = byRoute(p.back);
    assert.equal(p.kind, 'tab', `${s.route}: back chain ends at ${p.route}, not a tab root`);
  }
  for (const t of SCREENS.filter(x => x.kind === 'tab')) assert.equal(t.back, undefined, `${t.route}: a tab root has no Back`);
});

test('onboarding: step 2 has Back to step 1, and both steps have Skip to the plan', () => {
  const steps = SCREENS.filter(s => s.kind === 'onboarding');
  assert.equal(steps.length, 2);
  assert.equal(steps[1].back, steps[0].route);
  for (const s of steps) assert.ok(s.links.some(l => l.label === 'Skip ›' && l.href === HOME), `${s.route} has no Skip ›`);
});

test('no orphan screens: everything is reachable from the first screen', () => {
  const seen = new Set<string>(['/welcome']);
  const queue = ['/welcome'];
  while (queue.length) {
    const s = byRoute(queue.shift()!);
    const next = [...s.links.map(l => l.href), ...(s.back ? [s.back] : []), ...(s.tab ? TABS.map(t => t.route) : [])];
    for (const r of next) if (!seen.has(r)) { byRoute(r); seen.add(r); queue.push(r); }
  }
  assert.deepEqual([...seen].sort(), SCREENS.map(s => s.route).sort());
});

test('no dead ends: every screen says what is coming and is drawn by the shell for its own route', () => {
  for (const s of SCREENS) {
    assert.ok(s.coming.length > 20, `${s.route}: no "coming next" line`);
    const src = readFileSync(join(root, s.file), 'utf8');
    assert.ok(src.includes(`<PlannedScreen route="${s.route}"`), `${s.file} does not render the shell for ${s.route}`);
  }
});
