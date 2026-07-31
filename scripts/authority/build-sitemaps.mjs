import fs from 'node:fs';
const ownership = JSON.parse(fs.readFileSync('data/seo/route_ownership.json', 'utf8'));
fs.mkdirSync('artifacts/sitemaps', { recursive: true });
for (const host of Object.keys(ownership.hosts)) {
  const paths = [...new Set(['/guides', ...ownership.routes.filter((route) => route.host === host && route.indexable).map((route) => route.path)])].sort();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>https://${host}${path === '/' ? '/' : path}</loc><lastmod>2026-07-30</lastmod></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(`artifacts/sitemaps/${host}.xml`, xml);
}
console.log('Built route-ownership sitemaps');
