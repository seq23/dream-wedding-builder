import fs from 'node:fs';
import { sitemapPathsByHost, locFor, searchLoopEntries } from './sitemap-paths.mjs';
// Same ledger the served sitemap reads, so the artifact the cadence gate inspects
// and the XML crawlers fetch cannot report different dates for the same URL.
const ledger = JSON.parse(fs.readFileSync('data/seo/lastmod_ledger.json', 'utf8')).paths;
// Engine pages carry their own dates in the engine's ledger (published, or the
// day a strengthening rewrite or its undo landed).
const engineLastmod = new Map(searchLoopEntries().pages.map((p) => [p.route, p.lastmod]));
const lastmod = (path) => {
  const date = ledger[path]?.lastmod || engineLastmod.get(path);
  return date ? `<lastmod>${date}</lastmod>` : '';
};
fs.mkdirSync('artifacts/sitemaps', { recursive: true });
for (const [host, paths] of Object.entries(sitemapPathsByHost())) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${locFor(host, path)}</loc>${lastmod(path)}</url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(`artifacts/sitemaps/${host}.xml`, xml);
}
console.log('Built route-ownership sitemaps');
