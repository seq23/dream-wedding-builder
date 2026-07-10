import fs from 'node:fs'; import path from 'node:path';
const roots=['app','components','scripts','data','docs']; const bad=[]; const patterns=[/\bTODO\b/i,/\bFIXME\b/i,/coming soon/i,/lorem ipsum/i,/not implemented/i,/stub only/i];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx|js|mjs|json|md)$/.test(e.name)&&p!=='scripts/validate-no-stubs.mjs'){const t=fs.readFileSync(p,'utf8');for(const rx of patterns)if(rx.test(t))bad.push(`${p}: ${rx}`);}}}
for(const r of roots)if(fs.existsSync(r))walk(r);if(bad.length){console.error(bad.join('\n'));process.exit(1)}console.log('No stub markers found');
