#!/usr/bin/env node
import fs from 'node:fs';
const contract = JSON.parse(fs.readFileSync('data/distribution/distribution_contract.json', 'utf8'));
const ownership = JSON.parse(fs.readFileSync('data/seo/route_ownership.json', 'utf8'));
fs.mkdirSync('artifacts/distribution', { recursive: true });
const manifests = [];
for (const domain of contract.domains) {
  const paths = [...new Set(['/guides', ...ownership.routes.filter((route) => route.host === domain.host && route.indexable).map((route) => route.path)])].sort();
  const urls = paths.map((path) => `https://${domain.host}${path === '/' ? '/' : path}`);
  const urlFile = `artifacts/distribution/${domain.host}-urls.txt`;
  fs.writeFileSync(urlFile, urls.join('\n') + '\n');
  manifests.push({ ...domain, url_count: urls.length, url_file: urlFile });
}
fs.writeFileSync('artifacts/distribution/manifest.json', JSON.stringify({ generated_at: process.env.AUTHORITY_RUN_AT || '2026-07-30T00:00:00.000Z', domains: manifests }, null, 2) + '\n');
console.log(`Prepared distribution for ${manifests.length} domains / ${manifests.reduce((sum, item) => sum + item.url_count, 0)} URLs`);
