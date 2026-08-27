import ledger from '@/data/seo/lastmod_ledger.json';

// Real last-content-change dates, built by scripts/seo/build_lastmod_ledger.mjs
// from committed history and shipped as data because the Workers runtime has no
// git. Sitemap <lastmod> and Article dateModified both read from here, so a URL
// cannot advertise one freshness date in XML and a different one in its JSON-LD.
const paths = ledger.paths as Record<string, { lastmod: string; source: string } | undefined>;

/**
 * The date this path's content last actually changed, or undefined when the ledger
 * has no record of it. Callers must omit the field rather than substitute a
 * constant: a wrong freshness claim is worse than an absent one.
 */
export function lastmodFor(path: string): string | undefined {
  return paths[path]?.lastmod;
}

/** Spreads into a JSON-LD object, contributing nothing when the date is unknown. */
export function dateModifiedFor(path: string): { dateModified?: string } {
  const lastmod = lastmodFor(path);
  return lastmod ? { dateModified: lastmod } : {};
}

export const lastmodLedgerCommit = ledger.generated_from_commit;
export const lastmodLedgerPathCount = Object.keys(paths).length;
