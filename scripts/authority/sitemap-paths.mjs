import fs from 'node:fs';
import { searchLoopHost, searchLoopPages } from '../../lib/search-loop-pages.mjs';
// The one definition of which paths each host's sitemap lists. build-sitemaps.mjs
// writes from it and validate_sitemap_currency.mjs checks the committed XML
// against it, so the two can never keep their own lists.
export function sitemapPathsByHost(root = '.') {
  const ownership = JSON.parse(fs.readFileSync(`${root}/data/seo/route_ownership.json`, 'utf8'));
  const out = {};
  for (const host of Object.keys(ownership.hosts)) {
    const perHostPages = ownership.shared_host_routes.filter((path) => !path.includes('.'));
    out[host] = [...new Set([...perHostPages, ...ownership.routes.filter((route) => route.host === host && route.indexable).map((route) => route.path)])].sort();
  }
  // Pages the shared search engine published (search-loop.config.json, its ledger
  // data/search-loop/pages.json), on the host its base_url names.
  const engine = searchLoopEntries(root);
  if (engine.host && out[engine.host]) out[engine.host] = [...new Set([...out[engine.host], ...engine.pages.map((p) => p.route)])].sort();
  return out;
}

/** The engine's live pages and their lastmod; empty when the engine is not adopted. */
export function searchLoopEntries(root = '.') {
  try {
    const config = JSON.parse(fs.readFileSync(`${root}/search-loop.config.json`, 'utf8'));
    const ledgerFile = `${root}/${config.ledger_dir || 'data/search-loop'}/pages.json`;
    const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : { pages: [] };
    return { host: searchLoopHost(config), pages: searchLoopPages(config, ledger) };
  } catch {
    return { host: null, pages: [] };
  }
}
export const locFor = (host, path) => `https://${host}${path === '/' ? '/' : path}`;
