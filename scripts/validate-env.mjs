import fs from 'node:fs';
const env = fs.readFileSync('.env.example','utf8');
for (const key of ['APPS_SCRIPT_TREND_ENDPOINT','APPS_SCRIPT_TREND_SECRET']) {
  if (!env.includes(key)) { console.error('Missing env example key:', key); process.exit(1); }
}
const api = fs.readFileSync('app/api/submit-trend/route.ts','utf8');
if (!api.includes('APPS_SCRIPT_TREND_ENDPOINT')) { console.error('API does not reference Apps Script endpoint contract'); process.exit(1); }
console.log('env validation passed');
