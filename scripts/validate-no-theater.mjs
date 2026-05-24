import fs from 'node:fs';
import path from 'node:path';
const files = [];
function walk(dir){ for (const f of fs.readdirSync(dir)) { const p=path.join(dir,f); if (['node_modules','.next'].includes(f)) continue; const st=fs.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(ts|tsx|md)$/.test(f)) files.push(p); }}
walk('app'); walk('components'); walk('data'); walk('docs');
const forbidden = ['guaranteed quote', 'exact vendor price', 'auto-publish submitted'];
for (const file of files) {
  const text = fs.readFileSync(file,'utf8').toLowerCase();
  for (const term of forbidden) if (text.includes(term)) { console.error(`Forbidden theater phrase "${term}" in ${file}`); process.exit(1); }
}
const photos = fs.readFileSync('app/photos/page.tsx','utf8');
if (!photos.includes('No fake live vendor/product search is claimed')) { console.error('Photo search must state seeded/contract-ready posture'); process.exit(1); }
console.log('anti-theater validation passed');
