import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The unit suite needs the Node that ci.yml proves it on (nurture.test.ts imports
// node:sqlite, absent from Node 20). Full Safe Autonomy and Self-Heal run the same
// suite through `npm run selfheal` / `validate:all`; on Node 20 they went red on
// 2026-11-02 while ci.yml stayed green. Any workflow running the whole suite must
// set up the same Node major as ci.yml.
const dir = path.resolve(__dirname, '../../.github/workflows');
const SUITE = /npm run (-s )?(selfheal|validate:all|test)\b|npm test\b/;
const nodeMajors = (yml: string) => [...yml.matchAll(/node-version:\s*['"]?(\d+)/g)].map((m) => m[1]);

describe('workflows that run the unit suite use the Node ci.yml proves it on', () => {
  it('matches ci.yml node-version in every suite-running workflow', () => {
    const ci = nodeMajors(fs.readFileSync(path.join(dir, 'ci.yml'), 'utf8'));
    expect(ci.length).toBe(1);
    const runners = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f) && f !== 'ci.yml')
      .map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')] as const)
      .filter(([, yml]) => SUITE.test(yml.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')));
    expect(runners.map(([f]) => f)).toEqual(expect.arrayContaining(['full-safe-autonomy.yml', 'self-heal.yml']));
    const wrong = runners.filter(([, yml]) => { const v = nodeMajors(yml); return v.length === 0 || v.some((x) => x !== ci[0]); }).map(([f, yml]) => `${f}: ${nodeMajors(yml).join(',') || 'none'} (ci.yml: ${ci[0]})`);
    expect(wrong).toEqual([]);
  });
});
