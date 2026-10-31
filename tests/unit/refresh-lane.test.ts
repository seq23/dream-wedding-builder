import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The refresh lane pays down the refresh debt cadence_gate.js holds publishing on.
// These cases pin that a refresh is a real, fact-guarded content change and never a
// date bump: invented figures, names and citations are refused, a reword is refused,
// a rejected page is recorded with its reason, and an accepted one changes content.

const ROOT = process.cwd();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lane: any = await import(path.join(ROOT, 'scripts/cadence/refresh_lane.mjs'));

const OLD = {
  title: 'How to Plan a $20,000 Wedding Budget',
  summary: 'A $20,000 plan can support more vendor depth, but it still needs category caps and contract-level tracking.',
  recommendation: 'Set priority percentages, compare inclusive versus blank-space venue costs, record taxes and service charges, track cash by month, and require a tradeoff whenever one category expands.',
  working_example: 'Example: moving $1,500 into photography should identify the exact category that gives up $1,500 rather than raising the total silently.',
};
const GOOD = {
  summary: 'A $20,000 wedding budget works when every category has a written cap and each vendor amount is tracked from quote to signed contract, because extra vendor depth only helps if the caps hold.',
  recommendation: 'First set priority percentages for each category, then compare inclusive and blank-space venue costs with taxes and service charges included, schedule the cash due each month, and record which category gives ground whenever another one grows.',
  working_example: 'Example: if photography rises by $1,500, the budget names the category that gives up $1,500 before anything is signed, so the $20,000 total stays fixed instead of drifting.',
};

describe('refresh lane fact guards', () => {
  it('accepts a substantive rewrite that adds no figure, name or claim', () => {
    expect(lane.factGuard(OLD, GOOD)).toEqual([]);
  });
  it('refuses a figure the page does not already carry', () => {
    const p = lane.factGuard(OLD, { ...GOOD, working_example: 'Example: if photography rises by $2,500, name the category that gives up $2,500 before anything is signed.' });
    expect(p.join(' ')).toMatch(/introduces the figure "2500"/);
  });
  it('refuses an invented person, brand or reviewer', () => {
    const p = lane.factGuard(OLD, { ...GOOD, summary: GOOD.summary.replace('A $20,000 wedding budget works', 'Planner Jane Doe says a $20,000 wedding budget works') });
    expect(p.join(' ')).toMatch(/proper noun "Jane"/);
  });
  it('refuses citation and statistic language', () => {
    const p = lane.factGuard(OLD, { ...GOOD, summary: `According to a survey, ${GOOD.summary.charAt(0).toLowerCase()}${GOOD.summary.slice(1)}` });
    expect(p.join(' ')).toMatch(/claim language/);
  });
  it('refuses a reword of a few words - a refresh is not a date bump with extra steps', () => {
    const p = lane.factGuard(OLD, { ...OLD, summary: OLD.summary.replace('still needs', 'still requires') });
    expect(p.join(' ')).toMatch(/reword, not a refresh|unchanged/);
  });
  it('keeps the Example: hedge on the working example', () => {
    const p = lane.factGuard(OLD, { ...GOOD, working_example: GOOD.working_example.replace('Example: if', 'If') });
    expect(p.join(' ')).toMatch(/Example:/);
  });
  it('paces the queue to drain in about two weeks', () => {
    expect(lane.perRun(43, 67)).toBe(4);
    expect(lane.perRun(5, 30)).toBe(1);
    expect(lane.perRun(0, 0)).toBe(0);
  });
  it('calls a lane stalled only after three run days with nothing refreshed and a queue', () => {
    const run = (at: string, refreshed: number, queued = 60) => ({ at, refreshed, queued });
    expect(lane.stalled({ runs: [run('2026-11-01', 0), run('2026-11-02', 0)] })).toBe(false);
    expect(lane.stalled({ runs: [run('2026-11-01', 0), run('2026-11-02', 0), run('2026-11-03', 0)] })).toBe(true);
    expect(lane.stalled({ runs: [run('2026-11-01', 0), run('2026-11-02', 2), run('2026-11-03', 0)] })).toBe(false);
    expect(lane.stalled({ runs: [run('2026-11-01', 0, 0), run('2026-11-02', 0, 0), run('2026-11-03', 0, 0)] })).toBe(false);
  });
});

describe('refresh lane run', () => {
  function fixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-lane-'));
    for (const rel of ['data/authority/content_registry.json', 'data/authority/guide_composition_spec.json', 'data/authority/editorial_seeds.json', 'data/cadence/policy.json', 'data/search_intelligence/targets.json']) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.copyFileSync(path.join(ROOT, rel), path.join(dir, rel));
    }
    fs.cpSync(path.join(ROOT, 'artifacts/sitemaps'), path.join(dir, 'artifacts/sitemaps'), { recursive: true });
    return dir;
  }
  // A stand-in for the $0 model: rewrites the sentences it was sent, either
  // honestly or by inventing a figure.
  const model = (invent: boolean) => async (_url: string, init: { body: string }) => {
    const req = JSON.parse(init.body);
    const cur = JSON.parse(req.messages[1].content).current;
    const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, '');
    const reply = {
      summary: `Put simply, ${lc(cur.summary)}, and that holds only while one written record is kept current.`,
      recommendation: `Work in this order: ${lc(cur.recommendation)}, then check each change against that single record.`,
      working_example: invent ? 'Example: a couple who kept one written record of every quote and contract saved 37 percent against their first estimate.' : `${cur.working_example.replace(/\.$/, '')}, which the written record makes visible at once.`,
      change_note: 'tightened',
    };
    return { ok: true, status: 200, json: async () => ({ model: req.model, choices: [{ message: { content: JSON.stringify(reply) } }], usage: { cost: 0 } }) };
  };

  it('refreshes the oldest guides, changes their content, authorises them through the freeze and records the run', async () => {
    const dir = fixture();
    const before = JSON.parse(fs.readFileSync(path.join(dir, 'data/authority/content_registry.json'), 'utf8'));
    const receipt = await lane.runLane({ root: dir, apiKey: 'test', fetchImpl: model(false), today: new Date('2026-10-31'), log: () => {} });
    expect(receipt.outcome).toBe('REFRESHED');
    expect(receipt.refreshed.length).toBe(receipt.per_run);
    expect(receipt.per_run).toBeGreaterThan(0);
    const after = JSON.parse(fs.readFileSync(path.join(dir, 'data/authority/content_registry.json'), 'utf8'));
    for (const r of receipt.refreshed) {
      const slug = r.route.replace('/guides/', '');
      const a = after.pages.find((p: { slug: string }) => p.slug === slug);
      const b = before.pages.find((p: { slug: string }) => p.slug === slug);
      expect(a.summary).not.toBe(b.summary);
      expect(a.updated_at).toBe('2026-10-31');
    }
    const untouched = before.pages.filter((p: { slug: string }) => !receipt.refreshed.some((r: { route: string }) => r.route === `/guides/${p.slug}`));
    for (const b of untouched) expect(after.pages.find((p: { slug: string }) => p.slug === b.slug)).toEqual(b);
    const scope = JSON.parse(fs.readFileSync(path.join(dir, 'data/release/active_mutation_scope.json'), 'utf8'));
    expect(scope.routes).toEqual(receipt.refreshed.map((r: { route: string }) => r.route).sort());
    const ledger = JSON.parse(fs.readFileSync(path.join(dir, 'data/cadence/refresh_lane_ledger.json'), 'utf8'));
    expect(ledger.runs.at(-1)).toMatchObject({ outcome: 'REFRESHED', refreshed: receipt.refreshed.length });
  });

  it('refuses an invented figure, records why, and leaves the registry untouched', async () => {
    const dir = fixture();
    const before = fs.readFileSync(path.join(dir, 'data/authority/content_registry.json'), 'utf8');
    const receipt = await lane.runLane({ root: dir, apiKey: 'test', fetchImpl: model(true), today: new Date('2026-10-31'), log: () => {} });
    expect(receipt.outcome).toBe('NONE_PASSED_GUARDS');
    expect(receipt.rejected.length).toBeGreaterThan(0);
    expect(fs.readFileSync(path.join(dir, 'data/authority/content_registry.json'), 'utf8')).toBe(before);
    const ledger = JSON.parse(fs.readFileSync(path.join(dir, 'data/cadence/refresh_lane_ledger.json'), 'utf8'));
    const rejectedEntry = ledger.pages[receipt.rejected[0].route];
    expect(rejectedEntry.status).toBe('REJECTED');
    expect(rejectedEntry.reason).toMatch(/figure|claim language/);
  });

  it('names a stop instead of generating when no free model key is present', async () => {
    const dir = fixture();
    const receipt = await lane.runLane({ root: dir, apiKey: '', fetchImpl: model(false), today: new Date('2026-10-31'), log: () => {} });
    expect(receipt.outcome).toBe('MODEL_UNAVAILABLE');
    expect(receipt.stop).toBe('NO_FREE_MODEL_KEY');
    expect(receipt.refreshed).toEqual([]);
  });
});
