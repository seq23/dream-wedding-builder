import fs from 'node:fs';
const required = ['app/page.tsx','app/build/page.tsx','app/dashboard/page.tsx','app/trends/page.tsx','app/photos/page.tsx','app/pack/page.tsx','app/disclaimer/page.tsx','app/privacy/page.tsx','app/methodology/page.tsx','data/categories.ts','data/trends.ts','data/levers.ts','data/disclaimers.ts','REPO_IDENTITY.md','REPO_VALIDATION_MATRIX.md'];
const missing = required.filter(f => !fs.existsSync(f));
if (missing.length) { console.error('Missing required files:', missing); process.exit(1); }
const trends = fs.readFileSync('data/trends.ts','utf8');
for (const term of ['Lake Como Color Smoke Kiss Moment','Hidden-Server Champagne Wall','Vintage Phone Audio Guest Book']) {
  if (!trends.includes(term)) { console.error('Missing locked trend:', term); process.exit(1); }
}
const dash = fs.readFileSync('app/dashboard/page.tsx','utf8');
for (const term of ['Strict Budget Mode','Increase my budget','Turn off strict budget']) {
  if (!dash.includes(term)) { console.error('Missing strict budget escape hatch term:', term); process.exit(1); }
}
console.log('content validation passed');
