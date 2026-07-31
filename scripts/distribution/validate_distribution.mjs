import fs from 'node:fs';
const contract = JSON.parse(fs.readFileSync('data/distribution/distribution_contract.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('artifacts/distribution/manifest.json', 'utf8'));
const ownership = JSON.parse(fs.readFileSync('data/seo/route_ownership.json', 'utf8'));
const errors = [];
if (contract.domains.length !== 4) errors.push('domain contract != 4');
for (const domain of contract.domains) {
  const expected = new Set(['/guides', ...ownership.routes.filter((route) => route.host === domain.host && route.indexable).map((route) => route.path)]).size;
  const item = manifest.domains.find((entry) => entry.host === domain.host);
  if (!item || item.url_count !== expected) errors.push(`manifest count mismatch:${domain.host}:${item?.url_count ?? 0}/${expected}`);
  if (!fs.existsSync(`artifacts/sitemaps/${domain.host}.xml`)) errors.push(`missing sitemap artifact:${domain.host}`);
}
const route = 'app/sitemap.xml/route.ts';
if (!fs.existsSync(route)) errors.push('missing live /sitemap.xml route');
else {
  const src = fs.readFileSync(route, 'utf8');
  for (const token of ['x-forwarded-host', 'isCanonicalHost', 'route_ownership', 'application/xml']) if (!src.includes(token)) errors.push(`live sitemap route missing:${token}`);
}
for (const routePath of ['app/robots.txt/route.ts','app/llms.txt/route.ts']) if (!fs.existsSync(routePath)) errors.push(`missing live discovery route:${routePath}`);
if (errors.length) { console.error('DREAM DISTRIBUTION FAIL', errors); process.exit(1); }
console.log(`DREAM DISTRIBUTION PASS: ${manifest.domains.length} domains, ${manifest.domains.reduce((sum, item) => sum + item.url_count, 0)} URLs, host-aware discovery routes present`);
