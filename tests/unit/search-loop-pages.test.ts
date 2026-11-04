import { questionRetirementInventory } from '@/lib/question-retirements.mjs';
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { searchLoopPages, isSearchLoopPath } from '@/lib/search-loop-pages.mjs';
import { sitemapPathsByHost } from '../../scripts/authority/sitemap-paths.mjs';

// The shared search engine's pages reach crawlers through the sitemap and readers
// through the /questions hub; both read the engine's ledger through this one module,
// so a page the engine merges (90 days, no impressions) leaves both together.
const config = { base_url: 'https://weddingchecklistpdf.com', output: { url_prefix: '/questions/' } };
const ledger = { pages: [
  { slug: 'a', query: 'how early to book a venue', route: '/questions/a', status: 'live', published_at: '2026-11-01' },
  { slug: 'b', query: 'wedding budget split', route: '/questions/b', status: 'live', published_at: '2026-11-02', strengthen: { at: '2026-12-01', verdict: { at: '2026-12-15', undone: true } } },
  { slug: 'c', query: 'merged page', route: '/questions/c', status: 'merged', published_at: '2026-08-01' },
  { slug: 'd', query: 'outside the prefix', route: '/guides/d', status: 'live', published_at: '2026-11-01' },
] };

describe('search-loop pages', () => {
  it('lists live pages under the engine prefix, newest change first, with the latest real date', () => {
    expect(searchLoopPages(config, ledger)).toEqual([
      { route: '/questions/b', query: 'wedding budget split', lastmod: '2026-12-15' },
      { route: '/questions/a', query: 'how early to book a venue', lastmod: '2026-11-01' },
    ]);
  });

  it('owns its prefix and the hub, nothing else', () => {
    expect(isSearchLoopPath(config, 'https://weddingchecklistpdf.com/questions/a')).toBe(true);
    expect(isSearchLoopPath(config, '/questions')).toBe(true);
    expect(isSearchLoopPath(config, '/guides/a')).toBe(false);
  });

  it('puts live engine pages in the sitemap of the base_url host only', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-'));
    fs.mkdirSync(path.join(dir, 'data/seo'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'data/search-loop'), { recursive: true });
    fs.copyFileSync('data/seo/route_ownership.json', path.join(dir, 'data/seo/route_ownership.json'));
    fs.writeFileSync(path.join(dir, 'search-loop.config.json'), JSON.stringify(config));
    fs.writeFileSync(path.join(dir, 'data/search-loop/pages.json'), JSON.stringify(ledger));
    const byHost = sitemapPathsByHost(dir);
    expect(byHost['weddingchecklistpdf.com']).toEqual(expect.arrayContaining(['/questions', '/questions/a', '/questions/b']));
    expect(byHost['weddingchecklistpdf.com']).not.toContain('/questions/c');
    for (const host of ['weddingbudgetspreadsheet.com', 'weddingtimelinetemplate.com', 'weddingseatingchartmaker.com']) {
      expect(byHost[host].some((p: string) => p.startsWith('/questions'))).toBe(false);
    }
  });
});

describe('search-loop config carries the entity frame', () => {
  it('the engine page header states the brand and site Organizations exactly as entity.json does', () => {
    const cfg = JSON.parse(fs.readFileSync('search-loop.config.json', 'utf8'));
    const entity = JSON.parse(fs.readFileSync('data/seo/entity.json', 'utf8'));
    const host = new URL(cfg.base_url).host;
    const ld = JSON.parse(String(cfg.template.header_html).match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)![1].replace(/\\u003c/g, '<'));
    const byId = new Map(ld['@graph'].map((node: Record<string, unknown>) => [node['@id'], node]));
    for (const record of [entity.brand, entity.sites[host]]) {
      const node = byId.get(record['@id']) as Record<string, unknown>;
      expect(node, record['@id']).toBeTruthy();
      for (const key of ['name', 'url', 'logo', 'description']) expect(node[key], `${record['@id']} ${key}`).toBe(record[key]);
      expect(node.sameAs ?? []).toEqual(record.sameAs);
    }
    expect(cfg.site_name).toBe(entity.sites[host].name);
  });
});

describe('consolidated question inventory retains a nonzero guard', () => {
  const fixture = () => ({
    config: { mode: 'off' },
    ledger: { pages: [{ route: '/questions/old', status: 'merged', merged_into: 'https://weddingchecklistpdf.com/guides/kept' }] },
    rescue: { main_host: 'weddingchecklistpdf.com', redirects: { '/questions/old': '/guides/kept' } },
    ownership: { routes: [{ path: '/guides/kept', host: 'weddingchecklistpdf.com', indexable: true }] },
    entity: { brand: { name: 'Dream Wedding Builder', url: 'https://weddingchecklistpdf.com/', logo: '/logo.png', sameAs: ['https://example.com/profile'] } }
  });
  it('checks a direct destination for every retired question', () => {
    expect(questionRetirementInventory(fixture())).toEqual({ count: 1, targets: ['/guides/kept'] });
  });
  it('rejects zero inventory, missing destinations, redirect chains and incomplete publishers', () => {
    const empty = fixture(); empty.ledger.pages = [];
    expect(() => questionRetirementInventory(empty)).toThrow(/Zero/);
    const missing = fixture(); missing.ownership.routes = [];
    expect(() => questionRetirementInventory(missing)).toThrow(/destination/);
    const chain = fixture(); Object.assign(chain.rescue.redirects, { '/guides/kept': '/another' });
    expect(() => questionRetirementInventory(chain)).toThrow(/destination/);
    const entity = fixture(); entity.entity.brand.sameAs = [];
    expect(() => questionRetirementInventory(entity)).toThrow(/publisher/);
    const active = fixture(); active.config.mode = 'publish';
    expect(() => questionRetirementInventory(active)).toThrow(/publishing/);
  });
});
