#!/usr/bin/env node
// A publishing hold must have something scheduled that can clear it.
//
// PR #53 made cadence_gate.js a named HOLD on refresh debt and wrote the pages to
// refresh into reports/cadence/refresh-queue.json. Nothing read that queue, so the
// hold could only ever be cleared by a person - a stop that waits on the owner, and
// a stage that exits 0 having done nothing. This gate fails whenever the gate can
// hold publishing and no scheduled lane is wired to pay the debt down:
//
//   - package.json carries cadence:refresh -> scripts/cadence/refresh_lane.mjs,
//     and that file reads the same debt the gate does (refresh_debt.cjs), writes
//     the registry, and calls the $0 router;
//   - a SCHEDULED workflow runs `npm run cadence:refresh` with OPENROUTER_API_KEY,
//     after authority:scale:restore (which would revert it) and before
//     authority:scale:freeze (which would refuse it), clears the mutation scope
//     after the freeze, commits data/authority and data/cadence, and names the
//     outcome in an always() step.
//
// It hard-fails on zero items: no gate file, no hold path, or no workflows read.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = [];
const GATE = 'scripts/cadence_gate.js';

if (!fs.existsSync(path.join(root, GATE))) fail.push(`${GATE} is missing, so there is nothing to check the lane against`);
const gate = fail.length ? '' : read(GATE);
const gateCanHold = /hold\s*=\s*`REFRESH_DEBT/.test(gate) && /refresh-queue\.json/.test(gate);
if (gate && !gateCanHold) fail.push(`${GATE} no longer has the REFRESH_DEBT hold writing refresh-queue.json; this validator's premise moved - update it, do not delete it`);

const pkg = JSON.parse(read('package.json'));
const script = pkg.scripts?.['cadence:refresh'] || '';
const laneFile = (script.match(/node\s+(\S+\.m?js)/) || [])[1];
if (!laneFile) fail.push('package.json has no "cadence:refresh" script running a node file');
else if (!fs.existsSync(path.join(root, laneFile))) fail.push(`cadence:refresh points at ${laneFile}, which does not exist`);
else {
  const lane = read(laneFile);
  for (const [re, what] of [
    [/refresh_debt\.cjs/, 'read the debt through scripts/cadence/refresh_debt.cjs (the gate\'s own implementation)'],
    [/content_registry\.json/, 'write data/authority/content_registry.json'],
    [/routeChat\s*\(/, 'call the $0 router (routeChat)'],
    [/factGuard\s*\(/, 'hold rewrites to the fact guards'],
    [/active_mutation_scope\.json/, 'authorise its routes through the content freeze'],
  ]) if (!re.test(lane)) fail.push(`${laneFile} does not ${what}`);
}

const wfDir = path.join(root, '.github/workflows');
const workflows = fs.existsSync(wfDir) ? fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)).map((f) => ({ f, body: read(`.github/workflows/${f}`) })) : [];
if (!workflows.length) fail.push('no workflows found under .github/workflows');
const at = (body, re) => { const m = body.match(re); return m ? m.index : -1; };
const wired = workflows.filter(({ body }) => /^\s*schedule:/m.test(body) && /npm run cadence:refresh(?!\s*--)/.test(body));
if (!wired.length) fail.push('no scheduled workflow runs `npm run cadence:refresh` - the publishing hold cannot clear by itself');
for (const { f, body } of wired) {
  const lane = at(body, /run:\s*npm run cadence:refresh\s*$/m);
  const restore = at(body, /run:\s*npm run authority:scale:restore\s*$/m);
  const freeze = at(body, /run:\s*npm run authority:scale:freeze\s*$/m);
  const clear = at(body, /run:\s*npm run authority:scale:clear-scope\s*$/m);
  const commit = at(body, /git add data\/authority[^\n]*data\/cadence/);
  const block = body.slice(Math.max(0, body.lastIndexOf('- name:', lane)), lane);
  if (!/OPENROUTER_API_KEY:\s*\$\{\{\s*secrets\.OPENROUTER_API_KEY/.test(block)) fail.push(`${f}: the cadence:refresh step has no OPENROUTER_API_KEY from secrets, so it can only ever stop`);
  if (restore < 0 || lane < restore) fail.push(`${f}: cadence:refresh must run after authority:scale:restore, which would otherwise revert the refresh`);
  if (freeze < 0 || lane > freeze) fail.push(`${f}: cadence:refresh must run before authority:scale:freeze`);
  if (clear < 0 || clear < freeze) fail.push(`${f}: authority:scale:clear-scope must run after the freeze`);
  if (commit < 0 || commit < clear) fail.push(`${f}: the commit step must stage data/authority and data/cadence after the scope is cleared`);
  if (!/if:\s*always\(\)\s*\n\s*run:\s*npm run cadence:refresh -- --name-outcome/.test(body)) fail.push(`${f}: no always() step names the refresh lane outcome`);
}

let status = 'unknown';
let queued = null;
try { const g = JSON.parse(read('reports/cadence/cadence-gate.json')); status = g.status; } catch { /* first run */ }
try { queued = JSON.parse(read('reports/cadence/refresh-queue.json')).queue.length; } catch { /* first run */ }

if (fail.length) {
  console.error(`REFRESH LANE WIRING: FAIL (gate status ${status}, ${queued ?? '?'} queued)`);
  for (const p of fail) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`refresh lane wiring: PASS (gate status ${status}, ${queued ?? '?'} queued; lane ${laneFile} wired in ${wired.map((w) => w.f).join(', ')})`);
