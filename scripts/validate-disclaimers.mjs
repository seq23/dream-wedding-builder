import fs from 'node:fs';
const src = fs.readFileSync('data/disclaimers.ts','utf8') + fs.readFileSync('app/photos/page.tsx','utf8') + fs.readFileSync('app/pack/page.tsx','utf8');
const required = ['planning estimates only','does not guarantee pricing','Retail options may change','Photo analysis notice','not a substitute for a professional wedding planner'];
const missing = required.filter(x => !src.includes(x));
if (missing.length) { console.error('Missing required disclaimer text:', missing); process.exit(1); }
console.log('disclaimer validation passed');
