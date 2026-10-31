import fs from 'node:fs';
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
  return out;
}
export const locFor = (host, path) => `https://${host}${path === '/' ? '/' : path}`;
