import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

// Refresh debt governs publishing. On 2026-10-30 the 69 guides first published on
// 2026-07-30 crossed the 91-day window together and cadence_gate.js exited 1 on
// both scheduled lanes, with no lane able to clear it. These cases pin the shape
// that replaced it: publishing into debt fails, debt with nothing new published is
// a named HOLD the publisher also obeys, and a gate that measured nothing fails.

const ROOT = process.cwd();
const GATE = path.join(ROOT, 'scripts/cadence_gate.js');
const require = createRequire(import.meta.url);
const { refreshDebt } = require(path.join(ROOT, 'scripts/cadence/refresh_debt.cjs'));

const POLICY = { refresh_window_days: 91, high_value_window_days: 30, stale_tolerance_pct: 20, new_pages_per_week: 4, refresh_capacity_per_week: 25, require_lastmod: true };

function fixture(pages: { loc: string; lastmod: string }[], known: string[] | null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-'));
  fs.mkdirSync(path.join(dir, 'artifacts/sitemaps'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data/cadence'), { recursive: true });
  if (pages.length) {
    fs.writeFileSync(path.join(dir, 'artifacts/sitemaps/example.com.xml'),
      `<?xml version="1.0"?>\n<urlset>\n${pages.map((p) => `<url><loc>${p.loc}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  }
  fs.writeFileSync(path.join(dir, 'data/cadence/policy.json'), JSON.stringify(POLICY));
  if (known) fs.writeFileSync(path.join(dir, 'data/cadence/known_urls.json'), JSON.stringify({ urls: known }));
  return dir;
}
const run = (dir: string, today: string) => {
  const r = spawnSync(process.execPath, [GATE], { cwd: dir, env: { ...process.env, CADENCE_TODAY: today }, encoding: 'utf8' });
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'reports/cadence/cadence-gate.json'), 'utf8'));
  const queue = JSON.parse(fs.readFileSync(path.join(dir, 'reports/cadence/refresh-queue.json'), 'utf8'));
  return { status: r.status, out: r.stdout, report, queue };
};

// 10 pages: 6 dated 2026-07-30 (the real cohort), 4 recent.
const library = [
  ...Array.from({ length: 6 }, (_, i) => ({ loc: `https://example.com/guides/old-${i}`, lastmod: '2026-07-30' })),
  ...Array.from({ length: 4 }, (_, i) => ({ loc: `https://example.com/guides/new-${i}`, lastmod: '2026-10-20' })),
];
const locs = library.map((p) => p.loc);

describe('cadence gate: refresh debt governs publishing', () => {
  it('debt with nothing new published is a named HOLD, exit 0, with the oldest pages queued', () => {
    const r = run(fixture(library, locs), '2026-10-30');
    expect(r.report.urls).toBe(10);
    expect(r.report.stale_over_window).toBe(6);
    expect(r.status).toBe(0);
    expect(r.report.status).toBe('HOLD');
    expect(r.report.hold).toMatch(/^REFRESH_DEBT: /);
    expect(r.out).toContain('NAMED STOP  REFRESH_DEBT');
    // 6 stale, 20% of 10 allowed = 2, so 4 must be refreshed.
    expect(r.report.refreshes_needed).toBe(4);
    expect(r.queue.queue.length).toBe(6);
    expect(r.queue.queue[0]).toMatchObject({ lastmod: '2026-07-30', registry_slug: 'old-0' });
  });

  it('publishing even one new URL into refresh debt blocks, exit 1', () => {
    const extra = [...library, { loc: 'https://example.com/guides/brand-new', lastmod: '2026-10-30' }];
    const r = run(fixture(extra, locs), '2026-10-30');
    expect(r.status).toBe(1);
    expect(r.report.status).toBe('BLOCKED');
    expect(r.report.blocking.join(' ')).toMatch(/published_into_refresh_debt: 1 URL/);
  });

  it('debt with no URL ledger cannot prove nothing was published, so it blocks', () => {
    const r = run(fixture(library, null), '2026-10-30');
    expect(r.status).toBe(1);
    expect(r.report.blocking.join(' ')).toMatch(/^refresh_debt: .*no URL ledger/);
  });

  it('warns two weeks before a cohort crosses the window', () => {
    const r = run(fixture(library, locs), '2026-10-20');
    expect(r.status).toBe(0);
    expect(r.report.status).toBe('CLEAR');
    expect(r.report.warnings.join(' ')).toMatch(/refresh_debt_approaching: 6 of 10 pages/);
    expect(r.queue.queue.length).toBe(0);
  });

  it('a gate that found no sitemap URLs has measured nothing and fails', () => {
    const r = run(fixture([], []), '2026-10-30');
    expect(r.report.urls).toBe(0);
    expect(r.status).toBe(1);
    expect(r.report.blocking.join(' ')).toMatch(/no_sitemap_urls/);
  });
});

describe('refresh_debt.cjs is the one implementation both readers use', () => {
  it('computes the debt the gate and the publisher act on', () => {
    const urls = new Map(library.map((p) => [p.loc, p.lastmod] as [string, string]));
    const d = refreshDebt(urls, POLICY, new Date('2026-10-30'));
    expect(d.dated).toBe(10);
    expect(d.stale).toBe(6);
    expect(d.over_tolerance).toBe(true);
    expect(d.refreshes_needed).toBe(4);
    const before = refreshDebt(urls, POLICY, new Date('2026-10-29'));
    expect(before.stale).toBe(0);
    expect(before.approaching).toBe(true);
  });

  it('the publisher zeroes its budget on refresh debt and names the stop', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/authority_scale/publish_authority_batch.mjs'), 'utf8');
    expect(src).toContain("from '../cadence/refresh_debt.cjs'");
    expect(src).toMatch(/const budget = debt\.over_tolerance \? 0 : /);
    expect(src).toContain("code: 'HELD_REFRESH_DEBT'");
    expect(src).toMatch(/HELD_REFRESH_DEBT: '/);
    const gate = fs.readFileSync(GATE, 'utf8');
    expect(gate).toContain("require('./cadence/refresh_debt.cjs')");
    expect(gate).not.toMatch(/function sitemapUrls\(/);
  });
});
