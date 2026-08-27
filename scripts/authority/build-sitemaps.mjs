import fs from 'node:fs';
const ownership = JSON.parse(fs.readFileSync('data/seo/route_ownership.json', 'utf8'));
// Same ledger the served sitemap reads, so the artifact the cadence gate inspects
// and the XML crawlers fetch cannot report different dates for the same URL.
const ledger = JSON.parse(fs.readFileSync('data/seo/lastmod_ledger.json', 'utf8')).paths;
const lastmod = (path) => (ledger[path] ? `<lastmod>${ledger[path].lastmod}</lastmod>` : '');
fs.mkdirSync('artifacts/sitemaps', { recursive: true });
for (const host of Object.keys(ownership.hosts)) {
  const paths = [...new Set(['/guides', ...ownership.routes.filter((route) => route.host === host && route.indexable).map((route) => route.path)])].sort();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>https://${host}${path === '/' ? '/' : path}</loc>${lastmod(path)}</url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(`artifacts/sitemaps/${host}.xml`, xml);
}
console.log('Built route-ownership sitemaps');
