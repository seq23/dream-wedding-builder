// Guard: one IndexNow key for the repo, published as <key>.txt at the root of every
// host (public/ is served on all four), the distribution manifest submits every host,
// and the post-deploy lane submits after the Workers Builds deploy of each main commit.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOSTS } from './helpers/site-homes';

const key = readFileSync('public/indexnow-key.txt', 'utf8').trim();

describe('IndexNow', () => {
  it('covers all four hosts', () => { expect(HOSTS.length).toBe(4); });
  it('key is well formed and its key file holds exactly the key', () => {
    expect(key).toMatch(/^[A-Za-z0-9-]{8,128}$/);
    expect(existsSync(`public/${key}.txt`)).toBe(true);
    expect(readFileSync(`public/${key}.txt`, 'utf8').trim()).toBe(key);
  });
  it('the distribution manifest has a non-empty URL file for every host', () => {
    const m = JSON.parse(readFileSync('artifacts/distribution/manifest.json', 'utf8')) as { domains: Array<{ host: string; url_file: string }> };
    expect(m.domains.map((d) => d.host).sort()).toEqual([...HOSTS].sort());
    for (const d of m.domains) {
      const urls = readFileSync(d.url_file, 'utf8').split(/\r?\n/).filter(Boolean);
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls) expect(new URL(u).host).toBe(d.host);
    }
  });
  it('the post-deploy lane waits for Workers Builds, proves the key file, then submits live', () => {
    const wf = readFileSync('.github/workflows/indexnow-after-deploy.yml', 'utf8');
    expect(wf).toMatch(/push:\s*\n\s*branches: \[main\]/);
    const wait = wf.indexOf('Workers Builds'), prove = wf.indexOf('KEY_FILE_MISSING'), submit = wf.indexOf('scripts/distribution/submit_indexnow.mjs');
    expect(wait).toBeGreaterThan(-1);
    expect(prove).toBeGreaterThan(wait);
    expect(submit).toBeGreaterThan(prove);
    expect(wf).toContain('RUN_MODE: live');
  });
});
