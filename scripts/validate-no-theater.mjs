import fs from 'node:fs';
import path from 'node:path';

const files = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (['node_modules','.next'].includes(f)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx|md)$/.test(f)) files.push(p);
  }
}
walk('app'); walk('components'); walk('data'); walk('docs');

const forbidden = ['guaranteed quote', 'exact vendor price', 'auto-publish submitted', 'we contacted the venue', 'confirmed availability', 'definitely garden roses', 'found the exact dress'];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8').toLowerCase();
  for (const term of forbidden) if (text.includes(term)) { console.error(`Forbidden theater phrase "${term}" in ${file}`); process.exit(1); }
}

const activeStateFiles = ['app/page.tsx','app/free-wedding-planner/page.tsx','app/dashboard/page.tsx','app/pack/page.tsx'];
const activeStateForbidden = ['Lake Como · 125 guests', 'Old Money Garden Elegance celebration', 'style:</strong><br />Old Money Garden Elegance', 'location:</strong><br />Lake Como', "useState('Lake Como')", 'useState(125)', "useState<string[]>(['lake-como-color-smoke'])"];
for (const file of activeStateFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const term of activeStateForbidden) if (text.includes(term)) { console.error(`Active fake user state found in ${file}: ${term}`); process.exit(1); }
}

// The planner and the printed plan must carry the cost and not-a-planner disclaimers
// (claims safety). The internal wording pins ("Trace:", "Nothing is selected until the
// bride chooses it") were removed with that wording on 10 Nov 2026.
for (const file of ['app/free-wedding-planner/page.tsx', 'app/pack/page.tsx']) {
  const text = fs.readFileSync(file, 'utf8');
  for (const term of ['disclaimers.cost', 'disclaimers.professional']) if (!text.includes(term)) { console.error(`Missing disclaimer ${term} in ${file}`); process.exit(1); }
}

const photoAndScope = fs.readFileSync('app/photos/page.tsx','utf8') + fs.readFileSync('data/inspiration.ts','utf8');
for (const term of ['No fake live vendor/product search is claimed','Exact product/vendor/availability/pricing must be verified','Photo flower identification is possible but not guaranteed','Chandeliers require venue approval']) {
  if (!photoAndScope.includes(term)) { console.error(`Missing photo/scope anti-theater term: ${term}`); process.exit(1); }
}

// Only the claim checks stay here (no invented vendor contact, availability or
// prices; the shipped guardrail notices). Catalogue names, page markers and CTA
// test ids were wording pins and were removed on 1 Nov 2026; the e2e gauntlet
// exercises the trend catalogue and the Recommendation Studio paths.
console.log(`anti-theater validation passed (${files.length} files scanned)`);
