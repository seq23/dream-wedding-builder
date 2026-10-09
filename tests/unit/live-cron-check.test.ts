import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore -- plain .mjs script, no types
import { compareSchedules, readWranglerConfig } from '../../scripts/check-live-cron.mjs';

// Incident 2026-10-09: the hourly delivery retry (PR #24) must be scheduled on the
// live Worker after every deploy. The post-deploy check is only as good as this
// comparison, and it is only run if the production deploy command calls it.

describe('compareSchedules', () => {
  it('passes when every configured cron is live', () => {
    expect(compareSchedules(['0 * * * *'], [{ cron: '0 * * * *' }])).toEqual([]);
  });
  it('fails when the live Worker has no schedule', () => {
    expect(compareSchedules(['0 * * * *'], [])).toHaveLength(1);
  });
  it('fails when the live schedule differs from the config', () => {
    const problems = compareSchedules(['0 * * * *'], [{ cron: '*/30 * * * *' }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('NOT on the live Worker');
  });
  it('fails on zero configured crons (Rule 0: nothing checked is not a pass)', () => {
    expect(compareSchedules([], [{ cron: '0 * * * *' }])).toHaveLength(1);
  });
});

describe('wiring', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const config = readWranglerConfig();
  it('wrangler.jsonc schedules the hourly delivery retry', () => {
    expect(config.triggers?.crons).toContain('0 * * * *');
  });
  it('the production deploy command applies triggers, then checks the live schedule', () => {
    const deploy: string = pkg.scripts.deploy;
    const applyAt = deploy.indexOf('opennextjs-cloudflare deploy');
    const checkAt = deploy.indexOf('node scripts/check-live-cron.mjs');
    expect(applyAt).toBeGreaterThan(-1);
    expect(deploy).not.toMatch(/versions\s+upload/);
    expect(checkAt).toBeGreaterThan(applyAt);
    expect(deploy.slice(applyAt, checkAt)).toContain('&&');
  });
});
