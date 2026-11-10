// The pages the shared search engine (seq23/search-loop, search-loop.config.json)
// has published, read from its ledger (data/search-loop/pages.json). Plain ESM so
// the sitemap builder, the cadence gate and the Worker share one reading
// (tsconfig has allowJs: false; types in search-loop-pages.d.mts).
//
// The engine writes each page as a static file under output.dir and records it
// here; a page it merged (90 days, no impressions) leaves the ledger as
// status "merged" and is dropped from every list built from this function.

/** The URL prefix the engine owns, from its config. */
export function searchLoopPrefix(config) {
  return config?.output?.url_prefix || '/questions/';
}

/** The host the engine's pages are canonical on (its base_url). */
export function searchLoopHost(config) {
  return new URL(config.base_url).host;
}

/** Live engine pages: { route, query, lastmod }, newest first. */
export function searchLoopPages(config, ledger) {
  const prefix = searchLoopPrefix(config);
  const out = [];
  for (const p of ledger?.pages || []) {
    if (p?.status !== 'live' || typeof p.route !== 'string' || !p.route.startsWith(prefix)) continue;
    // A date only where the page's words changed (risk rule R-ADV-12): published, modified (engine
    // v1.10.0 sets it on every rewrite, refresh included), strengthened, or a strengthening undone.
    // A "kept" verdict or a refresh that found nothing to fix changes nothing, so it moves nothing.
    const dates = [p.published_at, p.modified_at, p.strengthen?.at, p.strengthen?.verdict?.undone ? p.strengthen.verdict.at : null].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || ''));
    out.push({ route: p.route.replace(/\/$/, ''), query: String(p.query || p.slug || ''), lastmod: dates.sort().at(-1) });
  }
  return out.sort((a, b) => (b.lastmod || '').localeCompare(a.lastmod || '') || a.route.localeCompare(b.route));
}

/** True when a path or URL belongs to the engine (its own lane, its own pace). */
export function isSearchLoopPath(config, pathOrUrl) {
  let pathname = pathOrUrl;
  try { pathname = new URL(pathOrUrl).pathname; } catch { /* already a path */ }
  const prefix = searchLoopPrefix(config);
  return pathname.startsWith(prefix) || pathname === prefix.replace(/\/$/, '');
}
