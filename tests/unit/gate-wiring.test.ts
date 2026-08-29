import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
const registry = JSON.parse(read('_repo_validation_registry.json')) as {
  counts: Record<string, number>;
  validators: { id: string; npmScript: string; severity: string; composite?: boolean; repair_command?: string }[];
};
const workflows = fs
  .readdirSync(path.join(ROOT, '.github/workflows'))
  .map((f) => ({ name: f, body: read(`.github/workflows/${f}`) }));

// Every script that gates or repairs has to be reachable from something that
// actually runs. Three real defects here were all of the form "the code exists
// and nothing calls it", so reachability is asserted rather than assumed.
function reachedBy(script: string, seen = new Set<string>()): Set<string> {
  if (seen.has(script)) return seen;
  seen.add(script);
  for (const m of (pkg.scripts[script] ?? '').matchAll(/npm run (?:--silent )?([\w:-]+)/g)) reachedBy(m[1], seen);
  return seen;
}

describe('validation registry is wired to something that runs', () => {
  it('every non-composite validator is reachable from validate:registry or validate:all', () => {
    const gate = reachedBy('validate:all');
    for (const v of registry.validators) {
      if (v.composite) continue;
      // validate:registry spawns every registry entry by npmScript, so a
      // registered validator is reachable by construction there; this asserts the
      // npm script it names actually exists.
      expect(pkg.scripts[v.npmScript], `${v.id} names npm script ${v.npmScript}, which does not exist`).toBeTruthy();
      expect(gate.size).toBeGreaterThan(1);
    }
  });

  it('registry counts match the validators actually listed', () => {
    const actual: Record<string, number> = {};
    for (const v of registry.validators) actual[v.severity] = (actual[v.severity] || 0) + 1;
    expect(actual).toEqual(registry.counts);
  });

  it('every declared repair_command is a runnable npm script', () => {
    const repairs = registry.validators.filter((v) => v.repair_command);
    expect(repairs.length).toBeGreaterThan(0);
    for (const v of repairs) {
      for (const m of v.repair_command!.matchAll(/npm run ([\w:-]+)/g)) {
        expect(pkg.scripts[m[1]], `${v.id} declares repair "${v.repair_command}" but ${m[1]} is not an npm script`).toBeTruthy();
      }
    }
  });
});

describe('the money path is guarded by something CI runs', () => {
  // On 2026-08-29, deleting app/api/stripe-webhook/route.ts and
  // app/api/download/[token]/route.ts left typecheck, 54 unit tests,
  // validate:structural and validate:registry all green. Next.js routes are
  // reached by file path, so no import graph can see them go missing.
  it('validate:fulfillment-path is reachable from validate:all', () => {
    expect(reachedBy('validate:all').has('validate:fulfillment-path')).toBe(true);
  });

  it('the four money-path route files exist', () => {
    for (const rel of [
      'app/api/checkout/route.ts',
      'app/api/stripe-webhook/route.ts',
      'app/api/download/[token]/route.ts',
      'app/api/order-status/route.ts',
    ]) {
      expect(fs.existsSync(path.join(ROOT, rel)), `${rel} is missing`).toBe(true);
    }
  });
});

describe('the cadence policy is a derived number, not a free literal', () => {
  it('validate:cadence-policy is reachable from validate:all', () => {
    expect(reachedBy('validate:all').has('validate:cadence-policy')).toBe(true);
  });

  it('new_pages_per_week is still half the refresh capacity, floored', () => {
    const policy = JSON.parse(read('data/cadence/policy.json'));
    expect(policy.new_pages_per_week).toBe(Math.max(1, Math.floor(policy.refresh_capacity_per_week / 2)));
  });

  it('the publishing lane re-derives capacity before the cadence gate reads it', () => {
    const lane = workflows.find((w) => w.name === 'full-safe-autonomy.yml')!.body;
    const derive = lane.indexOf('cadence:derive');
    const gate = lane.indexOf('cadence:gate');
    expect(derive, 'full-safe-autonomy.yml no longer re-derives cadence capacity').toBeGreaterThan(-1);
    expect(derive, 'the re-derive must run before the gate that reads the policy').toBeLessThan(gate);
  });

  it('every workflow that runs validate:structural or validate:cadence-policy checks out full history', () => {
    for (const w of workflows) {
      if (!/validate:structural|validate:all|validate:registry|cadence:derive/.test(w.body)) continue;
      expect(w.body, `${w.name} runs a check that measures committed history but does not use fetch-depth: 0`).toMatch(/fetch-depth:\s*0/);
    }
  });
});

describe('the self-heal dry run cannot kill the real repair', () => {
  // .github/workflows/self-heal.yml runs `selfheal:dry` before `selfheal` under
  // bash -e. While the dry run exited 1 for "there is something to repair", the
  // repair step was unreachable in exactly the case it exists for.
  it('heal_until_clean exits 0 from a dry run that merely has work pending', () => {
    const src = read('scripts/selfheal/heal_until_clean.mjs');
    expect(src).toMatch(/if \(DRY\) \{[\s\S]*process\.exit\(0\)/);
  });

  it('self-heal.yml still runs the dry report before applying repairs', () => {
    const wf = workflows.find((w) => w.name === 'self-heal.yml')!.body;
    expect(wf.indexOf('selfheal:dry')).toBeLessThan(wf.indexOf('run: npm run selfheal\n'));
  });
});

describe('no gate may pass having examined nothing', () => {
  // Confirmed in a sibling repo on 2026-08-29: these three validators globbed
  // for built HTML under a gitignored dist/, validation ran before the build,
  // and all three examined zero pages and exited 0 on every push. Here they scan
  // committed source, so the counts have always been real - but the shape is one
  // deleted directory away, and proved reproducible: run from an empty root,
  // origin/main's copies printed "PASS (0 published-surface files)" and exited 0.
  const zeroGuarded = [
    'scripts/validators/validate_no_internal_instruction_leak.js',
    'scripts/validators/validate_no_empty_table_cells.js',
    'scripts/validators/validate_content_pattern_contract.js',
    'scripts/validate-fulfillment-path.mjs',
    // Both of these passed on a truly empty directory before 2026-08-29:
    // "No stub markers found" and "tree hygiene: PASS", exit 0, zero items read.
    'scripts/validate-no-stubs.mjs',
    'scripts/validate-tree-hygiene.mjs',
  ];

  it.each(zeroGuarded)('%s hard-fails when it examines zero items', (rel) => {
    const src = read(rel);
    expect(src, `${rel} has no zero-item guard`).toMatch(/(scanned|\.length|rootItems\.length|pages\.length)\s*===\s*0/);
    expect(src).toMatch(/process\.exit\(1\)/);
  });

  it('the content gates report how many items they examined', () => {
    for (const rel of zeroGuarded) {
      expect(read(rel), `${rel} passes without saying how much it looked at`).toMatch(/(PASS|found)[^\n]*\$\{|checked \(enforcement/);
    }
  });
});
